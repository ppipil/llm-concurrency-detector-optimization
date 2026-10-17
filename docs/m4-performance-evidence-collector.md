# M4 Performance Evidence Collector

## Result

**M4: PASS**

The first runtime profiling pipeline ran successfully on the unchanged native-Windows baseline for `sympy__sympy-20228`. It preserved raw artifacts, normalized function and caller-callee evidence, classified source ownership, and produced a human-readable summary. No Agent, optimization patch, B0/B1/B2 run, Context Selector, Experience Store, or gold patch was used.

Validated on 2026-10-06 at repository commit `c237fe7f4c1a4abcfaef0e79600e26cba4ac0a6d`.

## Profiler Selection

M4 uses CPython's standard-library `cProfile` with `pstats` because it:

- runs natively on Windows with no extra package or compiler;
- provides function symbols, source files, function-start lines, primitive/total call counts, self time, cumulative time, callers, and callees;
- produces a binary `.prof` file that can be reparsed programmatically;
- reliably captures the high-frequency recursive path in this pure-Python workload.

`py-spy` remains a future low-overhead/native-frame cross-check. It was not required here because the requested call counts and relationships are directly available from `cProfile`. `line_profiler` requires choosing functions before localization, while Scalene introduces dependencies unnecessary for this first pipeline. This is a task-validated choice, not a universal profiler decision.

## Reproduction

From the repository root:

```powershell
npm run profile:sympy-20228
```

Equivalent command:

```powershell
.\workspaces\m2-sympy-20228\.venv\Scripts\python.exe scripts\performance-evidence\collect_sympy_20228.py
```

Optional arguments are `--workspace`, `--output`, and `--top`. The collector refuses a non-Windows host, wrong revision, or dirty baseline workspace. It hashes the workload and verifies that profiling leaves the target checkout unchanged.

## Preserved Evidence

The final validated run is stored locally at:

```text
results/raw/profiles/sympy__sympy-20228/20261006T091154.011Z/
```

It contains:

- `profile.prof`: raw binary cProfile capture;
- `pstats-self-time.txt` and `pstats-cumulative.txt`;
- `pstats-callers.txt` and `pstats-callees.txt`;
- workload stdout/stderr;
- `evidence.json`: normalized machine-readable evidence;
- `summary.md`: human-readable hotspot and call-path summary.

The final run recorded 4,259 functions and 8,871 relationships. The checkout was clean before and unchanged after profiling. A preceding diagnostic capture at `20261006T090919.148Z` exposed and helped correct classification of Python `<frozen ...>` frames. It is retained as raw provenance but superseded by the final run.

## Evidence Schema

The versioned contract is `experiments/schemas/performance-evidence.schema.json`. The record includes task revision/cleanliness, workload SHA-256, profiler identity, command/timestamps/environment, measurement separation markers, normalized functions and call relationships, and artifact paths.

Each function contains:

```text
id, function, source_file, source_line,
primitive_call_count, total_call_count,
self_time_seconds, cumulative_time_seconds,
runtime_share_percent, cumulative_share_percent,
ownership, repository_owned
```

Each relationship contains caller/callee IDs and edge-level primitive/total calls, self time, and cumulative time when supplied by `pstats`.

Ownership categories are `repository`, `external_dependency`, `standard_library`, `built_in`, and `evaluator`. `repository_owned` supplies the direct editable/non-editable distinction for later B1/B2 preparation. Runtime share is self time divided by total profiled self time; cumulative shares overlap and need not sum to 100%.

## Observed Hotspots

Top repository-owned functions by self time:

| Function | Source | Total calls | Self time | Cumulative time | Self share |
|---|---|---:|---:|---:|---:|
| `dup_mul` | `sympy/polys/densearith.py:735` | 387,500 | 50.382 s | 61.993 s | 61.36% |
| `dup_sqr` | `sympy/polys/densearith.py:835` | 12,340 | 2.433 s | 2.889 s | 2.96% |
| `<listcomp>` | `sympy/polys/densearith.py:536` | 269,800 | 1.276 s | 1.276 s | 1.55% |
| `_ask` | `sympy/core/assumptions.py:464` | 280,845 | 1.127 s | 8.409 s | 1.37% |
| `flatten` | `sympy/core/mul.py:111` | 22,080 | 0.610 s | 11.077 s | 0.74% |

The dominant non-repository entries were built-in `max`/`min` and standard-library random helpers. The dominant Python function is repository-owned, so the profile is not primarily trapped in an unmodifiable dependency.

## Meaningful Performance Path

The caller data identifies this baseline path:

```text
sympify                       sympy/core/sympify.py:92
  -> parse_expr               sympy/parsing/sympy_parser.py:908
  -> eval_expr                sympy/parsing/sympy_parser.py:896
  -> Function/sign evaluation
  -> Power.as_real_imag       sympy/core/power.py:1194
  -> poly                     sympy/polys/polytools.py:7136
  -> Poly.pow                 sympy/polys/polytools.py:1508
  -> DMP.pow                  sympy/polys/polyclasses.py:460
  -> dmp_pow                  sympy/polys/densearith.py:960
  -> dmp_mul                  sympy/polys/densearith.py:792
  -> dup_mul                  sympy/polys/densearith.py:735
```

Measured edges include:

- `Power.as_real_imag -> poly`: 20 calls, 64.870 s cumulative under instrumentation;
- `dmp_pow -> dmp_mul`: 60 calls, 57.235 s cumulative;
- recursive `dmp_mul -> dmp_mul`: 200,220 calls, 55.377 s cumulative;
- `dmp_mul -> dup_mul`: 256,100 calls, 61.993 s cumulative;
- recursive `dup_mul -> dup_mul`: 131,400 calls, 21.583 s cumulative.

This is meaningful for the public workload `sign(((a * b) ** 200))`: the evidence connects parsing and sign/real-imag evaluation to high-frequency polynomial exponentiation and multiplication. The interpretation uses only the baseline workload, profiler output, public task description, and repository source—not expert patches, expert-touched files, gold runtimes, or gold speedups. It identifies candidate evidence but does not prescribe an optimization.

## Benchmark Separation

The profile took 82.167 seconds wall time and the instrumented samples were around eight seconds. These numbers include tracing overhead and are not benchmark results. Only unprofiled M2/M3 measurements are eligible for speedup calculation. The record enforces this distinction:

```json
{
  "measurement_kind": "profiling",
  "benchmark_eligible": false,
  "profiler_overhead_included": true
}
```

## Limitations

- Deterministic tracing adds substantial per-call overhead and can affect relative attribution.
- `source_line` is the function definition/start line, not line-level timing.
- Recursive primitive and total calls require careful interpretation.
- Cumulative times overlap and must not be summed along a path.
- The full workload script is profiled, including one-time imports/setup, although the timed path dominates.
- Built-in/native work lacks fully symbolized native stacks.
- The collector is currently task-specific and single-process.
- Profiler times must never enter performance comparison, speedup, or M3 outcome classification.

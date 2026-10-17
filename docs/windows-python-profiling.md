# Native Windows Python Profiling Options

## Purpose

This note compares profiling candidates for unchanged SWE-efficiency workloads on native Windows. M4 has validated `cProfile` + `pstats` as the first structured collector for `sympy__sympy-20228`; this is not yet a universal profiler choice for every task.

Profiling locates work; unprofiled repeated runs measure performance. Profiler overhead can distort attribution, so profiler time is never benchmark time.

## Options

| Tool | Method | Native Windows | Best use here | Important limitation |
|---|---|---:|---|---|
| `cProfile` + `pstats` | Deterministic call tracing | Yes; standard library | Structured call counts, self/cumulative time, and call relationships | Adds per-call overhead; function-start line only; weak default multi-process support. |
| `py-spy` | Out-of-process sampling | Yes; official wheels | Low-overhead hotspot and native-frame cross-check | Short workloads need longer/repeated sampling; attach mode may need privileges. |
| Pyinstrument | In-process statistical profiler | Yes | Readable wall-clock call trees | Sampling can miss short functions; wall time includes waiting/I/O. |
| Yappi | In-process tracing profiler | Yes, subject to wheel verification | Thread/async follow-up | In-process tracing changes execution. |
| Scalene | Sampling/line-level CPU and memory profiler | Official Windows support | Python/native separation and targeted line investigation | Additional prerequisites and multiprocessing caveats need local validation. |
| `line_profiler` | Targeted line tracing | Windows packages available | Inspecting one or two already-localized functions | High distortion and requires preselecting functions. |

Sources: [Python profiler documentation](https://docs.python.org/3/library/profile.html), [py-spy repository](https://github.com/benfred/py-spy), [Pyinstrument design](https://pyinstrument.readthedocs.io/en/stable/how-it-works.html), [Yappi repository](https://github.com/sumerc/yappi), and [Scalene repository](https://github.com/plasma-umass/scalene).

## Validated M4 choice

For `sympy__sympy-20228`, `cProfile` + `pstats` was selected because it requires no extra Windows dependency and exposes function/start location, self/cumulative time, call counts, callers, and callees in a parseable form. The real capture is documented in `m4-performance-evidence-collector.md`.

`py-spy` remains the preferred low-overhead/native-frame cross-check when needed. Its absence from M4 does not make cProfile timings eligible as benchmark results.

## Staged use

1. Run correctness and the fixed unprofiled benchmark through the evaluator.
2. Use the task-appropriate profiler to collect localization evidence.
3. Normalize profiler-specific output into the shared evidence schema.
4. Use a sampling profiler as a cross-check when tracing overhead, native code, threads, or subprocesses are material.
5. Use line-level tooling only after a function has been localized.
6. Keep every profiler capture outside benchmark/speedup calculation.

## Evidence to preserve

- task ID, repository commit, workload hash, Python executable, and version;
- profiler name/version and exact command;
- working directory, timestamps, exit status, and environment;
- raw profiler artifact and console/workload output;
- self/cumulative time, calls, source location, ownership, and call relations;
- whether native frames, child processes, threads, or async tasks were included;
- target-workspace cleanliness before and after profiling.

Profiler artifacts belong under ignored `results/raw/profiles/`; normalized summaries may be versioned separately.

## Cross-task decision rule

The first implemented collector is `cProfile` for SymPy. A broader default remains pending. For native-heavy, threaded, or multi-process workloads, validate `py-spy`, Pyinstrument, or Yappi on the task rather than assuming the SymPy choice transfers. Scalene is not the default until its exact Windows behavior is verified locally.

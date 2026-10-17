# M3 Evaluation Harness

## Result

**M3: PASS**

The first minimal evaluator automates correctness and repeated unprofiled performance measurement for `sympy__sympy-20228`. It records raw samples and logs, calculates summary statistics and speedup, and applies a correctness-first outcome rule. No Pi/DeepSeek run, profiler, optimization, B0/B1/B2 execution, or Context Selector was used.

Validated on native Windows on 2026-10-06.

## Entry Points

- Evaluator: `scripts/evaluation/evaluate-sympy-20228.mjs`
- Statistics and classification: `scripts/evaluation/metrics.mjs`
- Unit tests: `scripts/evaluation/metrics.test.mjs`
- Evaluator-only task manifest: `experiments/tasks/sympy__sympy-20228/evaluator/manifest.json`
- Evaluator-only workload: `experiments/tasks/sympy__sympy-20228/evaluator/workload_windows.py`

Run the harness from the research repository root:

```powershell
npm run evaluate:sympy-20228 -- --repetitions 3 --baseline "results/raw/m2/sympy__sympy-20228/20261006T080440.869Z/summary.json"
```

Run the evaluator's deterministic unit tests separately:

```powershell
npm run test:evaluator
```

The target checkout must remain at commit `c237fe7f4c1a4abcfaef0e79600e26cba4ac0a6d`, with its virtual environment at `workspaces/m2-sympy-20228/.venv`. A different workspace can be supplied with `--workspace`, and a non-default evidence directory can be supplied with `--output`.

## Automated Flow

1. Read evaluator-only task metadata.
2. Verify the target checkout's exact Git revision.
3. Record changed tracked files and reject a modified correctness oracle as a correctness failure.
4. Run the eight covering SymPy correctness files and preserve stdout, stderr, exit code, wall time, and parsed summary.
5. Only after correctness passes, run the unchanged workload in the requested number of fresh Python processes.
6. Preserve every workload process log and all ten timing samples from every process.
7. Calculate count, mean, median, sample standard deviation, CV, minimum, and maximum.
8. When a baseline JSON is supplied, calculate `baseline mean / candidate mean` and classify the outcome.
9. Write `evaluation.json` and `summary.md` outside the Agent workspace.

Correctness failure takes precedence and produces `REGRESSION`; the benchmark is not run in that case. A workload execution or parsing failure is reported as evaluator status `ERROR` rather than being converted into an optimization outcome.

## Outcome Semantics

| Condition | Outcome |
|---|---|
| Correctness does not pass, including an altered tracked oracle | `REGRESSION` |
| Correctness passes and speedup is at or above the positive noise boundary | `SUCCESS` |
| Correctness passes and speedup lies strictly inside the noise interval | `NO_GAIN` |
| Correctness passes and speedup is at or below the negative noise boundary | `PERFORMANCE_REGRESSION` |

A correctness-passing run without a comparison baseline is a baseline-only measurement and has no optimization outcome (`null`).

## Preliminary Noise Rule

M2's 30 unchanged-checkout samples had an all-sample CV of `5.138592475870692%`. For M3, the provisional symmetric threshold is:

```text
threshold = max(10%, 2 × baseline all-sample CV)
```

For the preserved M2 baseline this is `10.277184951741384%`, giving:

- `SUCCESS` at speedup `>= 1.102771849517414`;
- `PERFORMANCE_REGRESSION` at speedup `<= 0.8972281504825862`;
- `NO_GAIN` between those boundaries, provided correctness passes.

The 10% floor is deliberately conservative for this first Windows task, while twice the observed CV prevents a noisier baseline from using an artificially narrow interval. This is an engineering rule for M3 harness validation, not the final statistical protocol. It must be revisited and frozen only after additional controlled baseline repetitions and environment controls are available.

## Validation Run

The real end-to-end validation run is stored locally under:

```text
results/raw/evaluations/sympy__sympy-20228/20261006T082157.395Z/
```

Observed output:

| Field | Value |
|---|---:|
| Evaluation status | `COMPLETED` |
| Correctness | `PASS` |
| Tests | 288 passed, 7 skipped, 8 expected failures |
| Benchmark processes | 3 |
| Raw samples | 30 |
| Mean | 4.493064 s |
| Median | 4.490167 s |
| Sample std | 0.070943 s |
| CV | 1.5789% |
| M2 baseline mean | 4.829267 s |
| Speedup | 1.074827× |
| Outcome | `NO_GAIN` |

The apparent 7.48% speedup is below the provisional 10.2772% boundary, so it is not treated as a performance gain. All 30 samples remain in `evaluation.json`; no timing sample was discarded.

## Evidence and Isolation

Each run directory contains:

- `evaluation.json`: complete machine-readable record;
- `summary.md`: human-readable result;
- `correctness.stdout.txt` and `correctness.stderr.txt`;
- one stdout and stderr file for every benchmark process.

The JSON also records the workload SHA-256, target revision, changed files, commands, exit codes, process wall times, Python version, dependency snapshot, and the fact that profiler measurement is disabled.

The target workspace receives none of these artifacts. The evaluator manifest, correctness-file list, workload, comparison baseline, raw evidence, and gold/reference information remain under project-owned evaluator/results paths. A later experimental Agent must be launched only in the target checkout with the contents explicitly designated Agent-visible.

## Current Limitations

- The evaluator is task-specific rather than a generic multi-task runner.
- The revision check allows a dirty candidate patch by design, but the current oracle-integrity check covers tracked modifications; stronger hashing/read-only staging should be added before experimental Agent runs.
- CPU affinity and priority remain at Windows defaults.
- The provisional threshold is based on one M2 baseline campaign and is not a final inference procedure.
- Timeout and structured crash-recovery policies are not yet implemented.

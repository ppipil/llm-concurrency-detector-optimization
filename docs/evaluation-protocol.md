# Evaluation Protocol

## Status

The M3 minimal evaluator is implemented and validated for `sympy__sympy-20228`. Its task-specific repetition policy and noise threshold are provisional; they are not yet the final cross-task statistical protocol.

## 1. Frozen groups

- B0 — Vanilla Coding Agent.
- B1 — Profiler-Guided Agent.
- B2 — Performance-Aware Context.
- B3 — B2 plus Outcome-Grounded Historical Experience.

Interim execution priority is B0–B2.

## 2. Frozen metrics

### Correctness

Pass/fail from the task's executable correctness tests.

### Speedup

```text
Speedup = baseline runtime / optimized runtime
```

### Optimization success rate

Fraction of tasks/runs satisfying both correctness and the later-defined meaningful-improvement criterion.

### Optimization cost

Iterations, tool calls, token usage, and wall-clock time.

## 3. Controls to define before execution

- exact task revisions and dependency lock;
- Windows machine and power/environment metadata;
- workload hash and correctness-test command;
- warm-up, repetition, timeout, and outlier policy;
- process isolation and background-load policy;
- meaningful-speedup and noise thresholds;
- Agent action, time, token, and benchmark budgets;
- ordering/randomization and repeated-run policy.

## 4. Required run artifacts

- immutable task and run manifests;
- Agent-visible context package and its size;
- Pi/DeepSeek configuration and complete trajectory/log references;
- pre/post source diff and hashes;
- raw test output and exit status;
- every raw benchmark sample;
- profiler artifact and normalized performance evidence when applicable;
- calculated metrics and outcome classification;
- environment metadata and timestamps.

## 5. Validity rules

- No correctness claim without executable tests.
- No speedup claim from profiler timing or a single selectively reported sample.
- No weakening or replacement of the workload or oracle after seeing a patch.
- No exposure of evaluator-only gold information to Pi/DeepSeek.
- Failed or negative runs remain part of the evidence record.
- Official/Linux benchmark figures must be labeled as references, not Native-Windows results.

## 6. M3 task-specific implementation

For `sympy__sympy-20228`, the evaluator runs the eight covering correctness files first. A correctness failure has priority and is classified as `REGRESSION`; performance measurement is skipped. Passing candidates are measured using three fresh Python processes with ten retained `timeit` samples per process. Benchmark execution is unprofiled and remains separate from any future profiling run.

The speedup formula is:

```text
Speedup = baseline mean runtime / candidate mean runtime
```

The provisional M3 noise boundary is `max(10%, 2 × baseline all-sample CV)`. M2's CV of `5.138592475870692%` yields a `10.277184951741384%` boundary. Correct candidates above the positive boundary are `SUCCESS`, candidates below the negative boundary are `PERFORMANCE_REGRESSION`, and candidates within the interval are `NO_GAIN`.

This rule is marked `PROVISIONAL_NOT_FROZEN` in machine-readable output. It is not a final statistical claim and must be reviewed after more baseline repetitions.

## 7. Pending entries

Cross-task statistical policies, final thresholds, and Agent budgets remain pending and will be added only after explicit design decisions and real Native-Windows validation.

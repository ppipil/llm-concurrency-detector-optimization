# M6 `optuna_optuna_5993` experiment preparation

This record freezes the minimal Native-Windows evaluator and pre-Agent evidence for a possible B0/B1/B2 calibration. It contains no Agent run, Optuna source edit, or formal comparison result.

## Fixed task and environment

- Repository: `optuna/optuna`
- Base commit: `d763594b1c081695e1fd14283210802521b59649`
- Python: CPython 3.10.8
- Optuna: 4.3.0.dev, editable base-commit checkout
- NumPy: 2.2.6
- SQLAlchemy: 2.0.55
- pytest: 8.3.5
- fakeredis: 2.40.0

Only Optuna's base editable installation, pytest, and the fakeredis dependency imported by the repository-wide storage test utility were installed. No GPU package, external database server, or complete optional test stack was required.

## Frozen correctness and benchmark

The correctness oracle combines three existing `inmemory` repository-test cases with three evaluator-owned state-consistency tests. It covers concurrent waiting-trial retrieval, WAITING-to-RUNNING transitions, resetting a running trial to WAITING and retrieving it again, ordinary storage state transitions, deleting a study containing waiting trials, and isolation of a replacement study. All six tests pass on the unchanged base commit.

The primary workload creates 10,000 non-waiting trials followed by one waiting trial. Outside the timed region, it fixes this state once. Each timed iteration pops the waiting trial and resets the same trial to `WAITING`, forcing the unchanged implementation to repeat the relevant lookup. Each sample performs 500 iterations after five warm-ups; 15 samples are retained per run.

| Run | Mean | Median | Standard deviation | CV |
|---|---:|---:|---:|---:|
| Frozen baseline | 0.160057 s | 0.160767 s | 0.003058 s | 1.910% |
| Independent repeat | 0.160850 s | 0.160892 s | 0.004416 s | 2.746% |

The means differ by 0.496%. The initial 100-iteration calibration capture had a 10.296% CV and is retained only in ignored raw results; it is not the frozen baseline.

Reproduction:

```powershell
$workspace = Resolve-Path workspaces\m6-optuna-5993-precheck
$output = Join-Path (Resolve-Path .) results\raw\m6\optuna_optuna_5993\<new-run-id>
& "$workspace\.venv\Scripts\python.exe" scripts\evaluation\evaluate-formulacode-optuna-5993.py `
  --workspace $workspace `
  --output $output
```

## Baseline profiler evidence

The shared `cProfile`/`pstats` collector ran the exact primary callable separately from benchmark timing. It passed, left the checkout clean, and emitted 149 functions and 208 call relationships. The WAITING-state filtering list comprehension at `optuna/storages/_in_memory.py:380` accounted for 65.39% self share. `_pop_waiting_trial_id` accumulated 0.214291 seconds; 0.201717 seconds flowed through `InMemoryStorage.get_all_trials`.

B1 successfully rendered the fixed mechanical Top-8 context (1,810 characters), including `_pop_waiting_trial_id`, `get_all_trials`, the list comprehension, and state-update calls. B2 consumed the same raw evidence under the identical character ceiling and selected `_pop_waiting_trial_id` and `FrozenTrial.number` (1,776 characters). The second target and artifact-test associations are weakly task-specific mechanical results and are retained without manual correction.

Profiler timings include deterministic instrumentation overhead and are ineligible for speedup calculations.

## Information boundary

The Agent-visible task description contains the public performance symptom and exact frozen workload dimensions so an Agent can reproduce the intended scenario inside its isolated checkout. Evaluator contracts, manifests, raw samples, raw profiler captures, selector audit, gold patch/touched files, and any future post-edit measurements remain evaluator-only. B1 and B2 may receive only their already-generated group-specific performance context.

No Agent was started, no Optuna source file was modified, and no gold or post-edit result was used to generate the evidence.

## Timing

Measured command time was approximately 90.0 seconds: checkout 25.898 seconds, environment installation 48.488 seconds, successful direct repository tests 0.808 seconds, benchmark calibration and frozen repetitions 11.707 seconds, profiling 1.115 seconds, B1/B2 read checks 1.473 seconds, and final validation 0.527 seconds. End-to-end preparation from workspace creation through recorded evidence took approximately 11.0 minutes, including inspection, dependency diagnosis, configuration authoring, and result review.

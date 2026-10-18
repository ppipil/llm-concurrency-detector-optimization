# M6 Midterm Results Audit

## Scope

This audit consolidates the twelve preserved B0/B1/B2 single-run calibrations for HIPS Autograd, Xarray, NetworkX, and Optuna at source checkpoint `c098119`. No Agent was rerun, no historical result was overwritten, and the Harness, Selector, evaluator, task sources, and paper were not changed. The additional Optuna checks are independent diagnostic-oracle probes and are not part of the frozen evaluator.

## Unified results

`Tokens` means provider-reported total tokens, including cache reads. Outcomes use the frozen correctness-first rule and the provisional 10% primary-speedup threshold. HIPS B0 did not originally store an explicit outcome; `NO_GAIN` below is the deterministic application of that same rule to its preserved samples.

| Task | Group | Frozen correctness | Speedup | Optimized CV | Frozen outcome | Turns | Tools | Tokens | Wall-clock |
|---|---|---:|---:|---:|---|---:|---:|---:|---:|
| HIPS Autograd | B0 | 42/42 PASS | 1.0222x | 2.31% | NO_GAIN | 27 | 35 | 639,970 | 205.119s |
| HIPS Autograd | B1 | 42/42 PASS | 1.1005x | 2.09% | SUCCESS | 30 | 44 | 826,506 | 341.110s |
| HIPS Autograd | B2 | 42/42 PASS | 1.0018x | 1.79% | NO_GAIN | 30 | 34 | 494,927 | 315.285s |
| Xarray | B0 | 13/13 PASS | 2.0612x | 6.69% | SUCCESS | 30 | 39 | 446,442 | 327.146s |
| Xarray | B1 | 13/13 PASS | 2.7242x | 9.46% | SUCCESS | 30 | 38 | 581,446 | 295.834s |
| Xarray | B2 | 13/13 PASS | 1.3762x | 2.19% | SUCCESS | 25 | 26 | 253,870 | 153.570s |
| NetworkX | B0 | 7/7 PASS | 1.9473x | 3.51% | SUCCESS | 21 | 20 | 181,013 | 208.037s |
| NetworkX | B1 | 7/7 PASS | 0.3671x | 7.82% | PERFORMANCE_REGRESSION | 27 | 28 | 256,901 | 223.185s |
| NetworkX | B2 | 7/7 PASS | 0.4261x | 13.33% | PERFORMANCE_REGRESSION | 18 | 21 | 140,299 | 157.534s |
| Optuna | B0 | 6/6 PASS* | 26.3143x | 6.14% | SUCCESS* | 30 | 37 | 553,370 | 236.033s |
| Optuna | B1 | 6/6 PASS* | 27.8122x | 4.63% | SUCCESS* | 30 | 35 | 710,302 | 295.934s |
| Optuna | B2 | 6/6 PASS* | 27.0854x | 3.25% | SUCCESS* | 30 | 40 | 641,443 | 320.745s |

`*` Optuna passed the frozen six-test evaluator, but the independent audit diagnostics found correctness regressions outside that oracle. The immutable historical outcome remains recorded, but these runs must not be presented as verified correctness-preserving successes.

## Verified facts

- All twelve runs used Native Windows, Pi 1.0.3, CSLab `CS/DeepSeek-V4-Flash-FP8`, and the same maximum budget: 30 model turns, 45 tools, 600 seconds, and a 60-second default bash timeout. Provider-total token stopping was disabled.
- Within every task, B0 had no pre-supplied evidence, B1 used mechanically ordered profiler Top-K evidence, and B2 used `performance-aware-context-mvp-v1` without B3 history. The preserved manifests state that gold patches, gold-touched files, post-edit results, and evaluator-only data were not exposed.
- B1/B2 used the same task-specific maximum evidence ceiling, but did not always consume the same number of characters. Observed B1/B2 context sizes were approximately 2,045/2,146 characters in the public normalized HIPS records (the B1 raw reference was 2,182), 1,726/1,694 for Xarray, 2,030/1,063 for NetworkX, and 1,811/1,777 for Optuna. NetworkX B2 used only about half of the available ceiling because the Selector found limited qualifying context. This is a property of the current selection method, but it means actual context volume was not controlled to equality.
- Xarray B0/B1/B2 achieved large primary gains, but Xarray B0 slowed the auxiliary interpolation workload to `0.7457x`; B1 was neutral (`1.0074x`) and B2 was slightly slower (`0.9657x`). The frozen outcome intentionally uses only the primary metric.
- NetworkX B1/B2 regressions and B0 gain are much larger than observed baseline noise. NetworkX B2 has high 13.33% CV, but its roughly 2.35x slowdown remains qualitatively clear.
- Optuna's recorded performance gains are much larger than its baseline variation, but performance does not override the newly observed correctness failures.

## Success and noise audit

The same threshold logic is consistently applied: correctness failure has priority; otherwise speedup at or above `1.10x` is `SUCCESS`, at or below `1/1.10` is `PERFORMANCE_REGRESSION`, and the middle region is `NO_GAIN`. The recorded Xarray, NetworkX, and Optuna classifications follow this rule. HIPS B1 is only `1.10054x`, barely above the threshold.

HIPS is the least stable comparison design in this calibration set. Its three groups each measured a fresh baseline with means `0.26787s`, `0.28865s`, and `0.24978s`; this 15.6% max/min spread is larger than B1's measured gain. Each group used only one warm-up and seven repetitions. Within-run CVs are low, but they do not capture this between-run drift. HIPS B1 must therefore be described as a threshold-crossing observation, not reliable evidence that B1 outperformed B0/B2.

The later tasks use one frozen baseline per task and 15 primary samples, with independent baseline repeats for NetworkX and Optuna. Xarray B0/B1 optimized CVs (6.69% and 9.46%) are higher than its 1.67% baseline CV, but their primary gains are still large. Close within-task rankings such as Optuna B1 versus B2 are not resolvable from one sequential run.

## Optuna independent diagnostic

The audit probe ran against the clean baseline and all three preserved patched workspaces without modifying them:

| Workspace | Reverse WAITING transition preserves trial order | Legacy pickle preserves existing WAITING trial |
|---|---|---|
| Clean baseline | PASS | PASS |
| B0 patch | FAIL: popped trial 1 before trial 0 | FAIL: missing `waiting_trial_ids` |
| B1 patch | FAIL: popped trial 1 before trial 0 | FAIL: missing `waiting_trial_ids` |
| B2 patch | PASS | FAIL: restored index is empty and omits trial 0 |

B0/B1 append trials that transition back to `WAITING`, changing the original canonical trial-number order. B2 uses sorted insertion and preserves this ordering. B0/B1 have no compatibility hook for an older `_StudyInfo` pickle. B2 has a hook, but initializing an absent index to an empty list does not reconstruct already-waiting trials. Under a correctness oracle that includes these independently verified behaviors, all three Optuna patches are regressions; B2 fixes only the ordering case. The historical evaluator and outcomes remain unchanged for provenance.

## Preliminary findings only

- Four tasks and one stochastic Agent run per group are insufficient for statistical or causal claims about B2.
- Task outcomes are mixed. B2 is faster to complete and uses fewer resources on Xarray and NetworkX, but not on HIPS or Optuna; its optimization outcome ranges from `SUCCESS` to `NO_GAIN`, `PERFORMANCE_REGRESSION`, and an audit-detected correctness regression.
- Benchmarks use task-specific workloads, warm-ups, and repetition counts. Speedups are meaningful within a task but must not be averaged naively across tasks.
- Correctness coverage is task-specific and incomplete. The Optuna finding demonstrates that passing the frozen suite does not prove general semantic preservation.
- Evidence ceilings were shared within a task, but actual B1/B2 context lengths were not exactly matched; the NetworkX difference is large enough to be a possible execution-efficiency confound.
- The tasks are calibration cases selected for Windows feasibility, not a randomized representative sample. Runs were sequential, not replicated or order-randomized.
- Provider-total tokens include cache-read traffic and are telemetry, not a direct reasoning-effort or cost measure.
- NetworkX Agents could not access the external frozen evaluator script and constructed ad-hoc diagnostics. This interface limitation may affect action trajectories even though final evaluation remained frozen and external.

## Next-stage work

1. Before formal Optuna use, decide whether waiting-order and legacy-pickle checks belong in the frozen correctness oracle. If approved, add them prospectively and rerun future formal conditions from clean workspaces; do not relabel or overwrite these calibration records.
2. Freeze a single baseline measurement protocol for every task, especially HIPS, with enough repetitions and independent baseline repeats to estimate between-run drift.
3. Run multiple independent Agent repetitions per task/group and randomize or counterbalance group order. Report distributions and uncertainty rather than single-run point estimates.
4. Standardize how the Agent is told to invoke the visible performance workload while keeping evaluator-only measurement isolated, addressing the NetworkX interface limitation equally for B0/B1/B2.
5. Preserve primary and auxiliary performance metrics, expand targeted semantic tests around every stateful optimization, and keep correctness-first classification.

The machine-readable audit manifest and independent diagnostic outputs are under `experiments/runs/m6-midterm-results-audit/`.

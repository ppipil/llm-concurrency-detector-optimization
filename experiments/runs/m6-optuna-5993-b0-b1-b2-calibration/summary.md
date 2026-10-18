# M6 Optuna 5993 B0/B1/B2 Calibration

This is a single-run real-Agent calibration on Native Windows. It is not formal statistical evidence and does not support a causal conclusion about B0, B1, or B2.

## Frozen conditions

- Task: `optuna_optuna_5993`
- Repository revision: `d763594b1c081695e1fd14283210802521b59649`
- Preparation checkpoint: `8935618bf25117f539ea02e9d4b37181fbd33be2`
- Model and harness: CSLab `CS/DeepSeek-V4-Flash-FP8`, Pi 1.0.3
- Budget per group: 30 model turns, 45 tool calls, 600 seconds wall-clock, 60 seconds default bash timeout
- Correctness: the same frozen six-test evaluator for every group
- Benchmark: five warm-ups, fifteen samples, 500 iterations per sample, 10,000 non-waiting trials
- B0 received no pre-supplied performance evidence. B1 received the pre-agent mechanical Top-8 profiler context. B2 received the pre-agent `performance-aware-context-mvp-v1` output. No B3 history, gold patch, gold-touched files, evaluator-only results, or post-edit evidence was supplied.

## Results

| Group | Correctness | Mean (s) | CV | Speedup | Outcome | First edit | First targeted test | Turns / tools | Wall-clock | Termination |
|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---|
| B0 | 6/6 | 0.00608252 | 6.14% | 26.31x | SUCCESS | 141.577s / T16 | 176.107s / T21 | 30 / 37 | 236.033s | model_turn_budget |
| B1 | 6/6 | 0.00575492 | 4.63% | 27.81x | SUCCESS | 141.677s / T14 | 165.361s / T16 | 30 / 35 | 295.934s | model_turn_budget |
| B2 | 6/6 | 0.00590934 | 3.25% | 27.09x | SUCCESS | 180.220s / T15 | 218.762s / T19 | 30 / 40 | 320.745s | model_turn_budget |

The frozen baseline mean was 0.16005711 seconds with 1.91% CV. An independent baseline repeat had mean 0.16085015 seconds with 2.75% CV. All optimized results exceed the provisional 10% meaningful-gain threshold by a wide margin. The optimized CVs are retained above; the close ordering among the three optimized means must not be treated as a reliable group ranking from one sequential run.

## Patch comparison and state-consistency risk

All three groups independently modified only `optuna/storages/_in_memory.py` and introduced an index for waiting trials, avoiding a full scan of all trials in the frozen workload.

- B0 stores waiting trial IDs, special-cases the exact `(WAITING,)` tuple, and maintains the ID list on creation and state changes.
- B1 also stores waiting trial IDs, accepts any single-state container containing `WAITING`, and maps IDs back to trial numbers when serving the query.
- B2 stores sorted waiting trial numbers, uses `bisect.insort` for transitions back to `WAITING`, and adds a `__setstate__` fallback for older pickles.

The frozen tests cover waiting-trial retrieval/thread safety, trial-state update, study deletion, and evaluator contract cases, and all three patches passed. Residual risks remain outside this finite suite: B0/B1 append a trial transitioning back to `WAITING`, which may differ from trial-number order after arbitrary state histories; B0/B1 do not add compatibility handling for previously pickled `_StudyInfo`; B2's legacy-pickle fallback initializes an empty index and therefore may not reconstruct already-waiting trials. These are calibration observations, not correctness failures established by the frozen evaluator.

## Execution-efficiency observation

B1 reached edit two turns earlier than B0 and reached its first targeted test about 10.7 seconds earlier, but consumed more wall-clock and provider-reported tokens because it spent more calls on tests. B2 did not improve action efficiency in this single run: it edited later, tested later, used the most tools, and took the longest. Since all groups hit the 30-turn soft boundary, these observations should be retained as trajectory evidence, not generalized as method effects.

Complete local trajectories, transcripts, prompts, summaries, and evaluator output are under `results/raw/m6/optuna_optuna_5993/`; their SHA-256 hashes are recorded in `manifest.json`. Exact patches and all unprofiled benchmark samples are copied into this checkpoint directory.

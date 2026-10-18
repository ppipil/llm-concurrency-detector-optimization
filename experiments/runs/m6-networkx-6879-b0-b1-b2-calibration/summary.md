# M6 `networkx_networkx_6879` B0/B1/B2 calibration

This is one real-Agent calibration run per group, not a formal statistical result. All groups used base commit `588326364848a165b045e419a63a4e62d568c615`, Pi `1.0.3`, CSLab `CS/DeepSeek-V4-Flash-FP8`, the same prompt skeleton and tools, and the calibration budget of 30 model turns, 45 tool calls, 600 seconds, and a 60-second default bash timeout. Each group started from a separate clean Native-Windows workspace with Python 3.10.8, NumPy 1.23.5, SciPy 1.10.1, and pytest 7.4.4.

B0 received no pre-supplied performance evidence. B1 received the frozen mechanically ordered Top-8 profiler evidence. B2 received the frozen `performance-aware-context-mvp-v1` output under the same 2,029-character evidence ceiling. No historical experience, gold patch, post-edit evidence, or result from another group was supplied.

## Frozen evaluation

The primary benchmark uses ten warm-ups followed by 15 samples. Each sample performs 100 calls to `rescale_layout()` on the same deterministic `100000 x 3` floating-point coordinate array. The frozen baseline mean was 0.1125852400 seconds with 4.195% CV; an independent baseline repeat had a 0.1105597933-second mean and 4.949% CV.

| Metric | B0 | B1 | B2 |
| --- | ---: | ---: | ---: |
| First edit | 23.306 s / turn 5 | 40.883 s / turn 7 | 38.510 s / turn 5 |
| First targeted test | 25.691 s / turn 6 | 90.668 s / turn 16 | 44.497 s / turn 6 |
| Correctness | 7 passed | 7 passed | 7 passed |
| Primary mean | 0.0578149600 s | 0.3067040600 s | 0.2642376867 s |
| Primary median | 0.0584438000 s | 0.2980572000 s | 0.2584878000 s |
| Primary CV | 3.509% | 7.825% | 13.335% |
| Primary speedup | 1.94734x | 0.36708x | 0.42608x |
| Frozen outcome | SUCCESS | PERFORMANCE_REGRESSION | PERFORMANCE_REGRESSION |
| Turns / tools | 21 / 20 | 27 / 28 | 18 / 21 |
| Wall-clock | 208.037 s | 223.185 s | 157.534 s |
| Provider total tokens | 181,013 | 256,901 | 140,299 |
| Uncached / cache-read / output | 29,904 / 142,080 / 9,029 | 33,743 / 215,552 / 7,606 | 24,548 / 110,336 / 5,415 |
| Termination | assistant_complete | assistant_complete | assistant_complete |

The classifier is correctness-first and uses the frozen primary speedup with the provisional 10% meaningful-gain threshold. All raw samples are preserved beside this summary and in the ignored raw run directories. B2's 13.335% CV is materially higher than the baseline CV and warrants caution about its point estimate, but its approximately 2.35x slowdown is far beyond both the 10% threshold and observed baseline variation. B1's regression is similarly large. B0's nearly 1.95x measured speedup is also much larger than observed noise.

## Patch comparison

- B0 initially tried full vectorization, measured that it was slow for low dimension counts, then retained the per-column centering loop while consolidating the global min/max scan and scaling into array-wide operations. This was the only successful patch under the frozen 3D workload.
- B1 replaced column-wise centering with `pos.mean(axis=0)`, used `abs(pos).max()`, and vectorized scaling. The frozen workload shows a strong performance regression.
- B2 also used `pos.mean(axis=0)` and vectorized scaling, but avoided the full absolute-value temporary by using global `pos.min()`/`pos.max()`. It was faster than B1 but still substantially slower than the unchanged baseline.

B2 reduced wall-clock, model turns, and provider usage compared with both B0 and B1, although it used one more tool call than B0. It did not reach an edit sooner than B0 and did not improve optimization effectiveness: B0 was the sole `SUCCESS`. Relative to B1, B2 was more execution-efficient and its patch regressed less, but both profiler-informed groups converged on an unsuitable full-axis mean for this fixed 3D workload.

The trajectories expose an evaluation-interface limitation to retain for interpretation: the fixed evaluator script is outside the isolated Agent checkout, so all groups searched for it unsuccessfully and constructed ad-hoc benchmarks. B0's further exploration happened to identify the low-dimensional regression and revise its patch; B1 and B2 concluded from different ad-hoc shapes that full vectorization was favorable. B2 also spent a tool call on `networkx/tests/test_all_random_functions.py`, reflecting the selector's imprecise lexical test association recorded during preparation. No strategy or evaluator was changed after observing these results.

Text copies of the three raw patches and all 15 benchmark samples are stored in this checkpoint directory. Complete prompts, trajectories, transcripts, test output, raw evaluations, and controller summaries remain in the ignored paths recorded and hashed in `manifest.json`.

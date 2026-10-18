# M6 `pydata_xarray_5541` B0/B1/B2 calibration

This is one real-Agent calibration run per group, not a formal statistical result. All groups used base commit `4fb34944ce853bca462b0d1c84787637f2d9e137`, Pi `1.0.3`, CSLab `CS/DeepSeek-V4-Flash-FP8`, the same prompt skeleton and tools, and the calibration budget of 30 model turns, 45 tool calls, 600 seconds, and a 60-second default bash timeout. Each group started from a separate clean Native-Windows workspace with Python 3.10.8, NumPy 1.23.5, pandas 1.4.4, SciPy 1.10.1, and pytest 7.4.4.

B0 received no pre-supplied performance evidence. B1 received the frozen mechanically ordered Top-8 profiler evidence. B2 received the frozen `performance-aware-context-mvp-v1` output under the same 1,725-character evidence budget. No historical experience, gold patch, post-edit evidence, or B0/B1 result was supplied to B2.

## Frozen evaluation

The primary benchmark used one warm-up followed by 15 independent samples of 100,000 one-dimensional `Variable.transpose()` calls. The auxiliary interpolation ASV workload used one warm-up and seven samples. The baseline primary mean was 0.5035988867 seconds and the auxiliary mean was 0.04950908572 seconds.

| Metric | B0 | B1 | B2 |
| --- | ---: | ---: | ---: |
| First concrete hypothesis | 30.924 s / turn 7 | 15.321 s / turn 3 | 38.358 s / turn 4 |
| First edit | 276.875 s / turn 25 | 166.817 s / turn 15 | 55.102 s / turn 9 |
| First targeted test | 281.227 s / turn 26 | 172.064 s / turn 16 | 66.793 s / turn 12 |
| Correctness | 13 passed | 13 passed | 13 passed |
| Primary mean | 0.2443229200 s | 0.1848595200 s | 0.3659349133 s |
| Primary CV | 6.694% | 9.463% | 2.187% |
| Primary speedup | 2.06120x | 2.72422x | 1.37620x |
| Frozen primary outcome | SUCCESS | SUCCESS | SUCCESS |
| Auxiliary mean | 0.06639508570 s | 0.04914435715 s | 0.05126742858 s |
| Auxiliary CV | 6.075% | 1.635% | 1.688% |
| Auxiliary speedup | 0.74567x | 1.00742x | 0.96570x |
| Turns / tools | 30 / 39 | 30 / 38 | 25 / 26 |
| Wall-clock | 327.146 s | 295.834 s | 153.570 s |
| Provider total tokens | 446,442 | 581,446 | 253,870 |
| Uncached / cache-read / output | 67,340 / 359,424 / 19,678 | 60,307 / 504,064 / 17,075 | 32,231 / 214,272 / 7,367 |
| Termination | model_turn_budget | model_turn_budget | assistant_complete |

The frozen outcome classifier is correctness-first and uses the primary speedup with the provisional 10% meaningful-gain threshold. It does not classify the auxiliary workload. The auxiliary B0 slowdown and the relatively high optimized-run CVs for B0/B1 are retained as observed; they must not be discarded or converted into a causal conclusion from these single sequential calibration runs.

## Patch comparison

- B0 adds a no-argument 0D/1D early return, avoids `infix_dims` for that case, and moves `get_axis_num` after the same-order early return.
- B1 moves `get_axis_num` after the early return and additionally changes `_replace` to reuse `_dims` and avoid copying absent attributes/encoding. This is the broadest patch of the three.
- B2 makes the smallest patch: it only moves `get_axis_num` after the existing no-op check, preserving the existing dimension-normalization path.

All three modify only `xarray/core/variable.py`. Text-normalized patch copies are stored beside this summary; the byte-exact raw patches remain in the ignored run directories. Complete prompts, trajectories, transcripts, raw timing samples, test output, and controller summaries remain in the ignored raw directories named in `manifest.json`; their hashes are recorded there.

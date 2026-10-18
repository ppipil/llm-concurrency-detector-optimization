# M6 `networkx_networkx_6879` experiment preparation

This record freezes the minimal Native-Windows evaluator and pre-Agent evidence for a possible B0/B1/B2 calibration. It contains no Agent run, source edit, or formal comparison result.

## Fixed task and environment

- Repository: `networkx/networkx`
- Base commit: `588326364848a165b045e419a63a4e62d568c615`
- Python: CPython 3.10.8
- NumPy: 1.23.5
- SciPy: 1.10.1
- pytest: 7.4.4

An editable install of the unchanged checkout is required because this historical NetworkX test configuration expects the package's `nx-loopback` entry point. SciPy is required because `networkx/drawing/tests/test_layout.py` uses module-level `pytest.importorskip("scipy")`.

## Frozen correctness and benchmark

The correctness oracle combines the repository's `TestLayout.test_rescale_layout_dict` with six evaluator-owned cases: reference-equivalence at 1, 2, 3, and 7 dimensions, in-place/identity behavior, and zero-extent behavior. All seven tests pass on the unchanged base commit.

The primary benchmark calls `rescale_layout()` on a deterministic `100000 x 3` floating-point coordinate array. Each sample performs 100 calls, after ten warm-up samples. Two independent 15-sample baseline runs produced:

| Run | Mean | Median | Standard deviation | CV |
|---|---:|---:|---:|---:|
| Frozen baseline | 0.112585 s | 0.110640 s | 0.004723 s | 4.195% |
| Independent repeat | 0.110560 s | 0.111595 s | 0.005471 s | 4.949% |

The means differ by 1.799%. Earlier calibration captures with shorter warm-up or 20 iterations are retained only in ignored raw results and are not the frozen baseline.

Reproduction:

```powershell
$workspace = Resolve-Path workspaces\m6-networkx-6879-precheck
$output = Join-Path (Resolve-Path .) results\raw\m6\networkx_networkx_6879\<new-run-id>
& "$workspace\.venv\Scripts\python.exe" scripts\evaluation\evaluate-formulacode-networkx-6879.py `
  --workspace $workspace `
  --output $output
```

## Baseline profiler evidence

The shared `cProfile`/`pstats` collector ran the exact primary callable separately from benchmark timing. It passed, left the checkout clean, and emitted 36 functions and 38 relationships. `rescale_layout` at `networkx/drawing/layout.py:1222` accounted for 41.80% self share and 0.095877 seconds cumulative time over 100 calls. NumPy reduction, absolute-value, mean, and maximum operations were its main callees.

B1 successfully rendered the fixed mechanical Top-8 context (2,029 characters). B2 consumed the same raw baseline evidence under the identical character ceiling and selected `rescale_layout` (1,062 characters). B2's lexical test association is imprecise (`networkx/tests/test_all_random_functions.py` rather than the drawing layout test); the evidence remains usable, but this limitation must be retained when interpreting a future B2 run.

Profiler timings include deterministic instrumentation overhead and are ineligible for speedup calculations.

## Timing and scope

Measured command time was approximately 50.4 seconds across checkout, environment installation, the successful direct test, benchmark calibration/runs, profiling, B1/B2 read checks, and final validation. End-to-end preparation from workspace creation through the recorded evidence took about 10.5 minutes, including inspection, the missing-entry-point/SciPy diagnosis, configuration authoring, and result review.

No Agent was started, no NetworkX source file was modified, and no gold patch or post-edit result was used.

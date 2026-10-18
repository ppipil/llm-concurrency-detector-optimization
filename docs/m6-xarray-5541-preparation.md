# M6 `pydata_xarray_5541` experiment preparation

This record freezes the Native-Windows evaluator and pre-Agent evidence for the next B0/B1/B2 calibration. It contains no Agent run and no formal comparison result.

## Fixed task and environment

- Repository: `pydata/xarray`
- Base commit: `4fb34944ce853bca462b0d1c84787637f2d9e137`
- Python: CPython 3.10.8
- NumPy: 1.23.5
- pandas: 1.4.4
- SciPy: 1.10.1
- pytest: 7.4.4

pandas 1.5.3 was rejected during preparation because the historical xarray tests import `UndefinedVariableError` from an internal pandas module that changed in 1.5. pandas 1.4.4 retains that interface and has a CPython 3.10 Windows wheel. The failed environment attempt remains under ignored raw results and is not a baseline result.

## Frozen evaluator

The primary benchmark performs 100,000 calls to one-dimensional `Variable.transpose()` per sample. It uses one warm-up and 15 measured samples. The auxiliary metric runs the repository's existing `Interpolation.time_interpolation("linear", True)` workload with one warm-up and seven measured samples. Neither workload is profiled during speed measurement.

The correctness oracle combines seven repository tests with six evaluator-owned semantic cases. It covers one-dimensional shallow-copy behavior, zero-dimensional variables, same-order and reordered multidimensional transpose, ellipsis, DataArray/Dataset behavior, axis lookup, period indexes, and invalid dimensions.

Reproduction:

```powershell
$workspace = Resolve-Path workspaces\m6-xarray-5541-precheck
$output = Join-Path (Resolve-Path .) results\raw\m6\pydata_xarray_5541\<new-run-id>
& "$workspace\.venv\Scripts\python.exe" scripts\evaluation\evaluate-formulacode-xarray-5541.py `
  --workspace $workspace `
  --output $output
```

## Baseline stability

| Metric | Samples | Mean | Median | Standard deviation | CV |
|---|---:|---:|---:|---:|---:|
| One-dimensional transpose | 15 | 0.503599 s | 0.505022 s | 0.008386 s | 1.665% |
| Short linear interpolation | 7 | 0.049509 s | 0.049273 s | 0.001333 s | 2.692% |

All 13 correctness checks passed. The complete samples are preserved in `experiments/runs/m6-pydata-xarray-5541-preparation/baseline-benchmark.json`.

## Baseline profiler evidence

`cProfile` was run separately over the primary operation. The capture passed, left the source checkout unchanged, and produced 36 functions and 43 call relationships. It located the intended repository path:

- `transpose` at `xarray/core/variable.py:1381`: 100,000 calls, 13.90% self share;
- `get_axis_num` at `xarray/core/common.py:160`: 100,000 calls, 6.55% self share;
- `copy` at `xarray/core/variable.py:884`: 100,000 calls, 4.10% self share.

Profiler runtime includes deterministic instrumentation overhead and is ineligible for benchmark or speedup calculations.

## B1/B2 read checks

B1 successfully rendered the fixed mechanical Top-8 profiler context. B2 successfully consumed the same raw evidence and, under the same 1,725-character ceiling, emitted 1,693 characters selecting `transpose` and `get_axis_num`.

The generic selector needed two preparation fixes: repository test discovery now supports package-local `*/tests` layouts, and common control words such as `for`/`not` are filtered from lexical relevance. Neither change introduces xarray-specific rules, patches, gold data, or post-edit results.

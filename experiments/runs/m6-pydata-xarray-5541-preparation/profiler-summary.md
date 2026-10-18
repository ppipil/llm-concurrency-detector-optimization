# Baseline profiler evidence

- Task: `pydata_xarray_5541`
- Base commit: `4fb34944ce853bca462b0d1c84787637f2d9e137`
- Profiler: CPython `cProfile` 3.10.8
- Status: `PASS`
- Purpose: context evidence only; profiler time is not benchmark time
- Profiled primary calls: 100,000
- Profile wall time: 2.2794863000162877 seconds
- Profiled self-time total: 1.7338567 seconds
- Functions / call relationships: 36 / 43

| Function | Location | Calls | Self time | Cumulative time | Self share |
|---|---|---:|---:|---:|---:|
| `transpose` | `xarray/core/variable.py:1381` | 100,000 | 0.240940 s | 1.698903 s | 13.90% |
| `_replace` | `xarray/core/variable.py:964` | 100,000 | 0.143679 s | 0.671716 s | 8.29% |
| `get_axis_num` | `xarray/core/common.py:160` | 100,000 | 0.113579 s | 0.484391 s | 6.55% |
| `infix_dims` | `xarray/core/utils.py:750` | 200,000 | 0.094318 s | 0.183673 s | 5.44% |
| `copy` | `xarray/core/variable.py:884` | 100,000 | 0.071101 s | 0.752489 s | 4.10% |

The profile exposes the task-relevant repository path and caller-callee relationships. Its deterministic instrumentation overhead is intentionally excluded from speedup measurement.

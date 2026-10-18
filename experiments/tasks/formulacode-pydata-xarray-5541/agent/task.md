# Performance Optimization Task

Repository: `pydata/xarray`

Base commit: `4fb34944ce853bca462b0d1c84787637f2d9e137`

Optimize repository performance while preserving correctness and public behavior.

## Initial observations

Transpose is noticeably slow, particularly for one-dimensional arrays where internal dimension-to-axis lookup is invoked unnecessarily and shallow copying is a significant part of the runtime.

## Validation

Use the supplied benchmark and targeted tests for measured validation. Do not modify or weaken tests or benchmark definitions.

# Performance Optimization Task

Repository: `networkx/networkx`

Base commit: `588326364848a165b045e419a63a4e62d568c615`

Optimize repository performance while preserving correctness and public behavior.

## Initial observations

`rescale_layout()` is noticeably slow for large NumPy coordinate arrays. The implementation performs repeated coordinate-wise work in Python, so the cost grows with the number of layout dimensions.

## Validation

Use the supplied fixed `rescale_layout()` benchmark and targeted tests for measured validation. Do not modify or weaken tests or benchmark definitions.

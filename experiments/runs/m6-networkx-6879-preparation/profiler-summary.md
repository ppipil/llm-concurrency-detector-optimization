# Baseline profiler summary

- Task: `networkx_networkx_6879`
- Revision: `588326364848a165b045e419a63a4e62d568c615`
- Profiler: CPython `cProfile` 3.10.8
- Status: `PASS`; source checkout unchanged
- Measurement purpose: profiling only; not eligible for speedup calculation
- Profiler wall time: 0.316 seconds
- Functions / call relationships: 36 / 38

The repository-owned hotspot was `rescale_layout` at `networkx/drawing/layout.py:1222`: 100 calls, 0.041969 seconds self time (41.80% self share), and 0.095877 seconds cumulative time. The main callees visible in the mechanical evidence were NumPy reductions, absolute value, mean, and maximum operations. `cProfile` reports function-start lines rather than per-line time.

B1 rendered a 2,029-character mechanical Top-8 context containing `rescale_layout`. B2 consumed the same baseline evidence and selected `rescale_layout` in 1,062 characters under the same 2,029-character ceiling. Its lexical test association points to `networkx/tests/test_all_random_functions.py`; this is a selector limitation, because the frozen correctness oracle separately uses the directly relevant drawing layout test and evaluator contract checks.

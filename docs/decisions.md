# Research Decisions

Only decisions that have actually been made are recorded here.

## 2026-10-05 — Native Windows execution environment

The study will use native Windows throughout. WSL and Linux are excluded by the research constraints.

## 2026-10-05 — Feasibility before optimization

No detector source will be optimized until a reproducible source build, benchmark baseline, and executable detection-regression oracle have been established.

## 2026-10-05 — Third-party source separation

Detector checkouts will live under `detectors/` and remain untracked. Project-owned automation, experiment manifests, results, and reports will be versioned separately.

## Pending decisions

- Target detector selection is not final.
- Profiler selection is not final.
- Benchmark workload and repetition protocol are not final.
- The exact `Threadcheck` repository must be confirmed before candidate selection.

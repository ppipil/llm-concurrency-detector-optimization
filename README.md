# LLM Concurrency Detector Optimization

This repository supports an MSc Guided Study on whether a fixed LLM coding agent can improve the runtime performance of concurrency-bug detection tools while preserving their detection capability.

## Current stage

The project is in feasibility analysis and baseline-environment preparation. No detector source optimization is permitted at this stage. All performance, profiling, and detection claims must come from real executable runs.

## Repository layout

- `docs/` — feasibility studies, comparisons, and research decisions.
- `detectors/` — local third-party detector checkouts (kept separate and not committed).
- `scripts/` — native-Windows setup, validation, and experiment automation.
- `experiments/` — versioned experiment definitions and manifests.
- `results/` — small, reviewable result summaries; large/raw outputs stay untracked.
- `reports/` — research reports and dissertation material.

The governing research design is in [RESEARCH_PLAN.md](RESEARCH_PLAN.md). Agent constraints are in [AGENTS.md](AGENTS.md).

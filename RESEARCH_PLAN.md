# Research Plan

## Research Background

Concurrency-bug detectors can impose substantial runtime or analysis-time cost. LLM coding agents may be able to optimize detector implementations, but a valid optimization must preserve the detector's externally verified ability to find known concurrency defects.

## Research Goal

Determine whether a fixed LLM coding agent can improve the performance of a concurrency-bug detection tool when supplied with profiler evidence and detector-specific, detection-preserving constraints.

## Research Questions

1. Can an LLM coding agent reduce detector runtime relative to an unchanged baseline?
2. Does profiler guidance improve optimization outcomes compared with a generic coding agent?
3. Does adding detector-aware context and detection-preserving constraints improve outcomes beyond profiler guidance alone?
4. Can observed speedups be attributed to detector-owned code while detection capability is preserved by executable regression tests?

## Proposed Method

1. Establish a reproducible native-Windows build and test baseline.
2. Select small, repeatable workloads and short traces.
3. Profile the unchanged detector and identify performance-critical code and call relationships.
4. Extract detector-specific context and explicit detection-preserving constraints.
5. Give this evidence to the same fixed LLM coding agent used in all treatment groups.
6. Generate candidate performance patches.
7. Re-run the benchmark and executable detection-regression suite.
8. Accept a result only when performance improves and detection capability is preserved.

The proposed method is a detector-aware optimization workflow, not merely a comparison of prompt wording or context quantity.

## Baselines

- A. Generic Coding Agent
- B. Profiler-guided Agent
- C. Profiler-guided + Detector-aware Method (proposed)

The same agent/model configuration should be held fixed across groups.

## Evaluation Metrics

Primary:

- Runtime and speedup.
- Detection capability preservation, determined from real detector output and executable tests.

Possible secondary metrics:

- Optimization success rate.
- Number of attempts.
- Token usage.

## Constraints

- Native Windows only; no WSL or Linux.
- Begin with small, repeatable workloads and short traces.
- Do not optimize detector source during feasibility and baseline establishment.
- Never fabricate benchmark, profiling, or detection results.
- Correctness is judged by real programs, test oracles, and detector output, not by an LLM.
- Do not change the research questions, baselines, proposed method, or evaluation design without an explicit recorded decision.
- Keep third-party detector source separate from project-owned experiment code.

## Current Progress

- Project repository initialized on 2026-10-05.
- DRace feasibility investigation completed at source-analysis level; local build remains unverified because required build dependencies are absent.
- ESBMC, Microsoft Coyote, and ChidcGithub/Threadcheck compared as additional candidates.
- SWE-fficiency task structure and its Linux/Docker assumptions have been reviewed.
- A provisional five-task native-Windows pilot shortlist and a minimal read/test/benchmark Harness design have been documented; no shortlisted task has yet been built or timed locally.
- No detector source has been modified.

## Next Steps

1. Confirm which `Threadcheck` project is intended; the current comparison assumes `ChidcGithub/Threadcheck`.
2. Select at most two candidates for a short native-Windows build/test pilot.
3. Install only the pinned toolchains required by that pilot.
4. Record immutable detector revisions and run unmodified detection tests.
5. Define a small benchmark protocol before any optimization work.
6. Validate the provisional SWE-fficiency shortlist on native Windows using unchanged source and preserved raw evidence.

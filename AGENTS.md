# Agent Instructions

These instructions apply to the entire repository.

1. Read `RESEARCH_PLAN.md` before starting every task.
2. Use native Windows for all work. Do not use WSL or Linux.
3. During the current feasibility and baseline-establishment stage, do not directly optimize detector source code.
4. Prioritize feasibility analysis, reproducible builds, test-oracle validation, and baseline establishment.
5. Never fabricate benchmark, profiling, build, or detection results.
6. Every experimental conclusion must come from a real executable program and preserved raw evidence.
7. Do not change the research question, baselines, proposed method, or evaluation design without explicit user approval and an entry in `docs/decisions.md`.
8. Detection capability and correctness must be evaluated using executable tests and actual detector output, never by the agent's own judgment alone.
9. Clearly separate third-party detector source under `detectors/` from project-owned scripts, experiment definitions, results, and reports.
10. Do not commit binaries, build outputs, profiler traces, large third-party dependencies, credentials, tokens, or secrets.
11. Record detector revision, toolchain versions, commands, workload, repetition count, and environment metadata for every experiment.
12. Suggestions that would alter the study design may be documented, but must not be applied without approval.

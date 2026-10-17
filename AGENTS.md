# Agent Instructions

These instructions apply to the entire repository.

1. Read `RESEARCH_PLAN.md` before every task. Research Plan v2 is the sole authority for the research questions, method, baselines, metrics, scope, and terminology.
2. Use native Windows only. Do not use WSL or Linux for project execution.
3. Do not change the research questions, B0–B3 baselines, evaluation metrics, proposed method, or Interim scope without explicit user approval and a corresponding entry in `docs/decisions.md`.
4. The current research topic is Performance-Aware Context Management for LLM-Based Code Performance Optimization. Do not resume DRace or other old detector surveys as current Interim work.
5. Pi Mono is the provisional experimental coding-agent harness, and CSLab DeepSeek is the experimental model. Codex may develop the research system but must not be represented as an experimental Agent.
6. Prioritize B0 Vanilla, B1 Profiler-Guided, and B2 Performance-Aware Context before Interim. Keep B3 outcome-grounded experience reuse to design/MVP work unless the user changes the schedule.
7. Do not implement Jev, MCP productization, multi-agent orchestration, true self-evolution, complex Skill systems, model training, a learned ranking model, or complex database infrastructure during the current stage.
8. Never fabricate build, test, benchmark, profiler, speedup, correctness, cost, or Agent-run results.
9. Every experimental conclusion must come from real executable programs and preserved raw evidence. Record repository revision, toolchain and dependency versions, commands, workload, warm-up/repetition policy, environment metadata, and exit status.
10. Correctness is determined by executable tests. Performance is determined by unprofiled benchmark runs. Profiler runtime must not be reported as benchmark runtime.
11. Keep Agent-visible task inputs separate from evaluator-only metadata. Never expose expert patches, expert-touched files, gold speedups, hidden oracle data, or post-edit reference results to the experimental Agent.
12. Keep third-party task checkouts under ignored `workspaces/`. Keep project-owned code, manifests, evidence summaries, and reports in their designated directories.
13. Performance evidence extraction, ranking, context selection, test execution, benchmark execution, outcome classification, and result calculation must be program-controlled. The LLM performs reasoning and coding over the context supplied to it.
14. Do not silently weaken tests, alter workloads, discard unfavorable timing samples, or change a task to make it pass.
15. Do not commit third-party source trees, virtual environments, binaries, build outputs, profiler captures, large raw artifacts, credentials, tokens, or secrets.
16. Historical detector material may be retained for provenance, but it must be labeled historical/superseded and must not be treated as an active requirement.

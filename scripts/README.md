# Scripts

This directory contains project-owned native-Windows automation.

Current entry points include:

- `research-controller/`: Pi SDK probes, CSLab smoke-test support, and M2 reproduction automation;
- `evaluation/`: the M3 correctness, benchmark, statistics, and outcome evaluator for `sympy__sympy-20228`.
- `performance-evidence/`: the M4 native-Windows profiler runner and normalized evidence collector.
- `experiments/`: native-Windows workspace preparation, fixed Pi baseline execution, and evidence aggregation for preliminary experiments.

Historical M5/M5b prompts, commands, budgets, and controller outputs remain preserved in their manifests and raw evidence. `experiments/summarize-m5b.mjs` can aggregate valid B0 and B1 evidence from separate infrastructure-retry run IDs. The active Agent entry point has since moved to the frozen M5c protocol and no longer accepts ad-hoc budget overrides.

For M5c and subsequent experiments, `research-controller/execution-policy.mjs` is the single frozen execution-policy source. `experiments/run-m5-agent.mjs` now consumes that policy and overrides Pi's built-in bash definition through the public SDK to add a 60-second default timeout. `experiments/summarize-m5c.mjs` verifies timeout injection and records `NO_PATCH` without running M3.

`research-controller/fast-sanity-policy.mjs` is a separate development-only policy used by M5d. It must not be imported as the formal B0–B3 policy. The M5d runner mode and summarizer preserve time-to-first-edit attempts, including aborted edits, so controller lifecycle failures are not mistaken for model behavior.

Later modules may cover:

- baseline correctness-test and benchmark execution;
- performance evidence collection and normalization;
- hotspot ownership/editability analysis;
- performance-aware target ranking and bounded context construction;
- Pi Mono and CSLab DeepSeek invocation adapters;
- outcome classification and experiment-cost accounting;
- B3 experience storage and simple retrieval after the B0–B2 path is stable.

Scripts must preserve raw stdout, stderr, commands, exit codes, timings, source revisions, and environment metadata. They must not silently install dependencies, modify workloads or test oracles, weaken tests, expose evaluator-only data to the Agent, or use WSL/Linux.

Do not implement Jev, MCP productization, multi-agent systems, true self-evolution, complex Skills, learned ranking models, or complex database infrastructure during the current Interim stage.

# Experiments

This directory contains versioned experiment definitions, not task source trees or raw execution output.

Contents and planned extensions include:

- task manifests with repository URL, immutable revision, workload, correctness-test entry point, and environment requirements;
- run manifests identifying B0, B1, B2, or B3, Pi/DeepSeek versions, context budget, limits, and random/repetition settings;
- Agent-visible context packages for each baseline;
- evaluator-only metadata stored separately from Agent-visible inputs;
- schemas for performance evidence, selected context, outcome records, and optimization cost.

Never place expert patches, expert-touched files, gold speedups, or hidden oracle data in a location exposed to Pi during a formal run. The existing SWE-efficiency candidate file is evaluator-side feasibility metadata and is not an Agent input.

Task checkouts belong under ignored `workspaces/`. Large raw logs and profiler artifacts belong under ignored `results/raw/`.

The first implemented task split is `tasks/sympy__sympy-20228/`: `agent/` contains only future Agent-visible task material, while `evaluator/` contains the hidden manifest, correctness selection, dependency pin, and benchmark workload.

Versioned machine-readable contracts live under `schemas/`. `schemas/performance-evidence.schema.json` defines the M4 normalized runtime-profile record used outside the Agent workspace.

Frozen run configurations live under `runs/`. `runs/m5-preliminary-sympy-20228/manifest.json` records the first B0/B1 treatment, equal tools/budgets, execution order, and information boundary.

`runs/m5b-baseline-completion-sympy-20228/manifest.json` records the user-authorized equal 80k-token completion run. It changes only the shared execution budget and common finish-within-budget instruction; the B0/B1 treatments remain unchanged.

`runs/m5c-frozen-execution-protocol-sympy-20228/manifest.json` freezes `agent-execution-v1` for subsequent B0–B3 work: 100k accounted tokens, ten minutes, 20 tools, 12 model turns, and a controller-injected 60-second default bash timeout. Empty-source-patch attempts are `NO_PATCH` and do not run the full evaluator.

`runs/m5d-fast-sanity-sympy-21391/manifest.json` is explicitly development-only. Its reduced `fast-sanity-v1` limits do not replace or amend `agent-execution-v1`.

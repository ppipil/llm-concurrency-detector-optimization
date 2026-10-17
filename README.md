# Performance-Aware Context Management for LLM-Based Code Performance Optimization

This repository supports an MSc Guided Study on how real profiler evidence and execution-grounded optimization experience can be used to select bounded, high-value context for an LLM coding agent working on repository-level performance optimization.

`RESEARCH_PLAN.md v2` is the sole authoritative research plan. If another document conflicts with it, the research plan takes precedence.

## Current scope

The project is currently preparing the Interim-stage system and evaluation framework:

- Native Windows only; no WSL or Linux execution.
- Pi Mono is the provisional coding-agent harness.
- CSLab DeepSeek is the experimental model.
- Interim priority is B0 Vanilla Agent, B1 Profiler-Guided Agent, and B2 Performance-Aware Context.
- B3 outcome-grounded experience reuse is limited to design and an MVP before Interim.
- Jev, MCP productization, multi-agent systems, true self-evolution, complex Skill systems, model training, and large-scale evaluation are out of scope for the current stage.

Codex is used to develop the research system. It is not an experimental coding agent.

## Research system

The planned workflow is:

```text
Performance task
  -> baseline benchmark and correctness tests
  -> profiler evidence
  -> performance-aware context selection
  -> Pi Mono + CSLab DeepSeek
  -> patch
  -> correctness tests and benchmark
  -> outcome classification
  -> optional verified experience for later reuse
```

All performance and correctness claims must come from preserved executable evidence. Profiler output helps select context but is not itself a benchmark result.

## Frozen experimental groups

- **B0 — Vanilla Coding Agent:** task, repository, Pi Mono, and CSLab DeepSeek.
- **B1 — Profiler-Guided Agent:** B0 plus a profiler hotspot summary without the proposed selector.
- **B2 — Performance-Aware Context:** ranked targets plus bounded relevant code, call paths, and tests.
- **B3 — Full Method:** B2 plus outcome-grounded historical experience.

The frozen evaluation dimensions are correctness, speedup, optimization success rate, and optimization cost.

## Repository layout

- `docs/` — design, related work, evaluation protocol, feasibility studies, and research decisions.
- `experiments/` — versioned task and run definitions; evaluator-only data must remain separate from Agent-visible inputs.
- `scripts/` — future project-owned Windows automation for profiling, context selection, Pi integration, tests, benchmarks, and result processing.
- `results/` — experiment evidence and derived summaries; large raw artifacts remain untracked.
- `reports/` — Interim/Final report material derived from verified evidence.
- `workspaces/` — ignored third-party task checkouts used during future execution.
- `detectors/` — historical location from the superseded detector-focused phase; no current Interim work is planned there.

Start with [RESEARCH_PLAN.md](RESEARCH_PLAN.md), then [AGENTS.md](AGENTS.md), [docs/system-design.md](docs/system-design.md), and [docs/evaluation-protocol.md](docs/evaluation-protocol.md).

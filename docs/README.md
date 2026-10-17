# Documentation

`RESEARCH_PLAN.md v2` at the repository root is the sole authoritative research plan.

## Current design documents

- `system-design.md` — component boundaries and B0–B3 data flow.
- `evaluation-protocol.md` — frozen metrics, required evidence, and protocol placeholders.
- `related-work.md` — literature-review framework; it currently contains no verified literature claims.
- `pi-cslab-deepseek-smoke-test.md` — M1 native-Windows Pi/CSLab environment verification record.
- `m2-reproducible-performance-task.md` — accepted Native-Windows task and baseline evidence.
- `m3-evaluation-harness.md` — minimal evaluator, outcome semantics, provisional noise rule, and validation run.
- `m4-performance-evidence-collector.md` — profiler choice, normalized evidence schema, real hotspots, and limitations.
- `m5-preliminary-b0-b1.md` — first real B0/B1 run, evaluator results, behavior comparison, and validity findings.
- `m5b-baseline-completion.md` — equal-budget 80k B0/B1 completion attempt, infrastructure retries, evaluator evidence, and PARTIAL result.
- `m5c-frozen-execution-protocol.md` — frozen common Agent limits, controller-enforced bash timeout, B0/B1 validation runs, and NO_PATCH handling.
- `m5d-fast-sanity.md` — second-task development sanity check and final-turn tool-cancellation blocker.
- `windows-python-profiling.md` — profiler feasibility notes supporting the future evidence collector.
- `swefficiency-windows-feasibility.md` — static task and Native-Windows feasibility analysis.
- `decisions.md` — active, historical, and pending implementation decisions.

## Historical documents

- `minimal-agent-harness.md` predates Research Plan v2. Only its safety and evidence-capture concepts remain reusable; Pi Mono and the current system design take precedence.

Historical detector research, if added later for provenance, must be clearly labeled `historical / superseded` and must not be placed on the current Interim work path.

Reusable, credential-free configuration examples belong under `docs/templates/`. Real API endpoints, keys, and local credential files must remain untracked.

No design document may present an unexecuted command, placeholder value, official Linux reference result, or Agent assertion as a Native-Windows experimental result.

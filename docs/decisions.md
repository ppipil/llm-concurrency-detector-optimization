# Research Decisions

Only decisions that have actually been made are recorded here. `RESEARCH_PLAN.md v2` is authoritative if this log is incomplete or inconsistent.

## Active decisions

### 2026-10-05 — Research direction v2

The active research topic is **Performance-Aware Context Management for LLM-Based Code Performance Optimization**. The study investigates bounded selection of real performance evidence and the reuse of outcomes grounded by executable tests and benchmarks.

The earlier detector-centered research direction is superseded for current Interim work. Historical detector material is retained only for provenance. No further DRace, ESBMC, Coyote, Threadcheck, or similar detector survey is currently planned.

### 2026-10-05 — Native Windows execution environment

All project execution will use native Windows. WSL and Linux are excluded.

### 2026-10-05 — Provisional experimental Agent stack

Pi Mono is the provisional coding-agent harness. CSLab DeepSeek is the experimental model. Codex is used to develop the research system and does not participate as an experimental Agent.

If Pi and CSLab DeepSeek later prove technically incompatible, a harness substitution may be proposed, but it must not alter the research questions, method, baselines, or evaluation metrics.

### 2026-10-05 — Frozen baselines and Interim priority

The experimental groups are:

- B0 — Vanilla Coding Agent.
- B1 — Profiler-Guided Agent.
- B2 — Performance-Aware Context.
- B3 — B2 plus Outcome-Grounded Historical Experience.

B0, B1, and B2 are the Interim priority. B3 is limited to design and an MVP before Interim unless the schedule is explicitly changed.

### 2026-10-05 — Frozen evaluation dimensions

The evaluation dimensions are correctness, speedup, optimization success rate, and optimization cost. Results must be grounded in real test and benchmark execution.

### 2026-10-05 — Evidence and source separation

Third-party task checkouts will live under ignored `workspaces/`. Project-owned scripts, experiment definitions, result summaries, and reports will remain versioned separately.

Agent-visible inputs must be separated from evaluator-only gold metadata to prevent benchmark leakage.

### 2026-10-06 — First Native-Windows performance task

`sympy__sympy-20228` at commit `c237fe7f4c1a4abcfaef0e79600e26cba4ac0a6d` is accepted as the first reproducible performance task after real native-Windows validation.

It was selected because it is pure Python at the target revision, has a deterministic fixed-expression workload of measurable duration, installs without a native compiler, and has an executable correctness oracle. The unchanged checkout passed all eight covering test files, and 30 unprofiled workload samples completed successfully. This decision admits the task to later experimental preparation; it does not authorize optimization or start B0/B1/B2.

### 2026-10-06 — Provisional M3 noise rule

The first evaluator uses `max(10%, 2 × baseline all-sample CV)` as a symmetric, provisional noise boundary. With the M2 baseline CV of `5.138592475870692%`, the current boundary is `10.277184951741384%`.

This rule supports M3 implementation and validation only. It is explicitly not the final statistical design and does not change the frozen evaluation metric of speedup. The threshold will be reviewed after more controlled baseline repetitions; any final protocol decision must be recorded separately.

### 2026-10-06 — First M4 structured profiler

CPython `cProfile` with `pstats` is selected for the first `sympy__sympy-20228` Performance Evidence Collector. It was validated on the unchanged native-Windows baseline and provides function/start line, self and cumulative time, call counts, and caller-callee data without an additional dependency.

This is a task-level choice, not a frozen universal profiler. Deterministic tracing overhead makes its time profiling evidence only and categorically excludes it from benchmark and speedup calculation. Sampling/native-frame cross-checks remain appropriate for later task types.

### 2026-10-07 — M5b shared completion budget

The M5b preliminary completion run used the user-authorized shared limits of 80,000 accounted tokens, 30 tool calls, 20 assistant turns, and 600 seconds for both B0 and B1. Both prompts also received the same instruction to form a patch early and reserve budget for tests. No treatment, model, tool, task, evaluator, metric, or information boundary changed.

The run remains PARTIAL: valid B0 and B1 executions both ended at a fixed limiter without producing a patch, although both unchanged workspaces passed M3 correctness and received `NO_GAIN`. Two separate CSLab request-timeout attempts are preserved and excluded as infrastructure failures. This outcome does not change the baselines or research design.

### 2026-10-07 — Frozen Agent execution protocol v1

All subsequent B0/B1/B2/B3 runs share `agent-execution-v1`: 100,000 accounted tokens, 600 seconds, 20 tool calls, 12 model turns, and a 60-second default bash timeout injected by the research controller. Pi 1.0.3 itself is not modified. Prompts may state only the common diagnose/implement/test, bounded-analysis, no-workload-expansion, and evaluator/gold-isolation constraints recorded in the M5c manifest.

M5c validated the controller behavior on one B0 and one B1 run. A B0 command was stopped by the injected timeout and the loop continued; both loops then stopped at their configured resource boundary. Neither produced a source patch, so both were classified `NO_PATCH` and the full M3 benchmark was skipped. Protocol validation is PASS, while M5 remains PARTIAL. Completed-response token accounting can overshoot the nominal ceiling by the final response and remains a reported implementation limitation.

### 2026-10-07 — M5d development-only FAST policy

M5d used a separate, temporary `fast-sanity-v1` policy on `sympy__sympy-21391`: 60k accounted tokens, four minutes, 12 tools, eight model turns, and a 30-second default bash timeout. This did not modify `agent-execution-v1` and produced no formal performance result.

The run exposed a controller blocker: B0 emitted an edit on its permitted final turn, but the turn limiter aborted the tool before it completed. B1 never edited. Neither ran targeted tests. Therefore the sanity check failed, the earlier 20228 behavior cannot be called task-specific, and progression to M6 is not yet supported.

## Historical / superseded decisions

### 2026-10-05 — Detector feasibility before optimization

The former detector-focused plan required a reproducible detector build, benchmark baseline, and detection-regression oracle before optimizing detector source. This remains a valid record of the earlier direction but is superseded for current Interim work by Research Plan v2.

### 2026-10-05 — Detector checkout location

The former plan placed candidate detector checkouts under `detectors/`. That directory is now historical. New SWE-efficiency or other performance-task checkouts must use ignored `workspaces/` instead.

## Pending implementation decisions

These are unresolved implementation parameters, not invitations to change the frozen research design:

- Cross-task profiler policy beyond the validated SymPy `cProfile` collector.
- Remaining Native-Windows tasks needed to reach the planned 3–5 task set.
- Final benchmark warm-up, repetition, noise, and meaningful-speedup thresholds beyond the provisional M3 rule.
- Whether and how to add a contemporaneous unchanged control or interleaved baseline policy after M5 exposed temporal baseline drift; no evaluation metric has been changed.
- A stricter pre-request token-budget mechanism after the preliminary M5 event-level limiter overshot by one response.
- Context budget, Top-K value, and coefficients for the frozen priority formula.
- Pi Mono and CSLab DeepSeek interface details and version pins.
- Minimal representation and retrieval rules for B3 experience reuse.

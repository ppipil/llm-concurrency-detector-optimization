# System Design

## Status

Design framework aligned with `RESEARCH_PLAN.md v2`. The M3 Outcome Evaluator and first task-specific M4 Performance Evidence Collector are implemented; B0/B1/B2 execution and the Context Selector remain outside the completed scope.

## 1. Design objective

Build a reproducible native-Windows research system that supplies a fixed Pi Mono + CSLab DeepSeek coding Agent with different context treatments while keeping task, model, limits, and evaluator behavior controlled.

The research contribution is context management, not a new coding Agent or profiler.

## 2. System boundary

Project-controlled components:

- baseline test and benchmark runner;
- Performance Evidence Collector;
- Performance-Aware Context Selector;
- Context Builder;
- Pi/DeepSeek adapter and run recorder;
- Outcome Evaluator;
- optional minimal B3 experience store and retriever.

External/fixed components:

- task repository and workload;
- Pi Mono harness;
- CSLab DeepSeek model/service;
- selected profiler;
- repository correctness tests.

## 3. Data flow

```text
Task manifest
  -> unchanged correctness baseline
  -> unchanged benchmark baseline
  -> profiler capture
  -> normalized performance evidence
  -> baseline-specific context package
  -> Pi Mono + CSLab DeepSeek
  -> candidate patch
  -> correctness tests + unprofiled benchmark
  -> outcome and cost record
  -> optional verified experience
```

## 4. Module A — Performance Evidence Collector

Required normalized fields:

- function identifier;
- self time and total time;
- runtime share;
- call count;
- relevant call path;
- source file and line;
- project-owned/third-party/native classification;
- baseline runtime and repository revision;
- correctness-test references.

Profiler-specific parsing must be isolated from the normalized evidence schema.

The first implementation uses `cProfile`/`pstats` for `sympy__sympy-20228` and emits schema-versioned JSON with function evidence, call relationships, ownership, run metadata, and raw artifact references. Profiler time is explicitly ineligible for benchmark/speedup calculations.

## 5. Module B — Performance-Aware Context Selector

The frozen first-version ranking form is:

```text
Priority(h) =
    alpha * RuntimeImportance
  + beta  * CallFrequency
  + gamma * Editability
  + delta * HistoricalGain
  - lambda * RegressionRisk
  - mu     * TriedPenalty
```

Coefficient values, normalization, missing-history behavior, tie-breaking, and Top-K remain implementation parameters to be recorded without changing the formula or research question.

## 6. Context Builder

The bounded context package should contain only the selected Top 1–3 targets and their relevant:

- performance evidence;
- source excerpts;
- call paths;
- correctness tests;
- concise selection rationale;
- for B3 only, a small number of verified successful/failed experiences.

The builder must record exact byte/token size and every included source.

## 7. Coding Agent adapter

The provisional experimental stack is Pi Mono with CSLab DeepSeek. The adapter must keep model and harness settings fixed across groups and record tool calls, token usage when available, wall-clock time, and the final patch.

Codex is outside the experimental path.

## 8. Module C — Outcome Evaluator

The evaluator owns correctness tests and unprofiled benchmarks. It classifies an attempt as:

- `SUCCESS`: tests pass and meaningful speedup is measured;
- `NO_GAIN`: tests pass without meaningful speedup;
- `REGRESSION`: correctness tests fail;
- `PERFORMANCE_REGRESSION`: tests pass but execution is slower.

The meaningful-speedup and noise thresholds remain pending implementation decisions.

## 9. Module D — Outcome-Grounded Experience

For the Interim stage, define only a minimal structured record covering pattern, target, action, measured outcome, correctness, profiler effect, failure reason, and evidence references. No claim of true self-evolution is permitted.

## 10. Baseline isolation

- B0 receives task/repository information only.
- B1 additionally receives an unselected profiler hotspot summary.
- B2 receives program-ranked, bounded performance-aware context.
- B3 receives B2 context plus limited verified historical experience.

All other Agent, task, budget, and evaluator settings should remain controlled.

## 11. Information-security boundary

Agent-visible inputs must exclude expert patches, gold-touched files, gold speedups, hidden oracle data, and later-group context. Evaluator-only metadata must live outside the Pi working directory.

## 12. Deferred features

Jev, MCP productization, multi-agent systems, true self-evolution, complex Skills, model training, learned ranking models, complex databases, and large-scale benchmark execution are explicitly deferred.

## 13. M6 selector MVP

The first B2 selector is deterministic. It combines normalized runtime importance, log-scaled call frequency, task/source lexical relevance with one-hop call-graph propagation, repository ownership, mechanically discovered tests, and a call-graph-centrality risk penalty. It writes the complete ranking and reasons to an audit JSON and emits only the highest-ranked targets that fit the fixed B1-sized context budget. It does not use patches, post-edit results, historical outcomes, or an LLM ranker.

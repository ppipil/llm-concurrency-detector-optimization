# Related Work

## Status

Document framework only. Literature claims and citations have not yet been collected or verified. Do not treat the headings below as evidence that the stated research gap has been established.

## Review question

What prior work exists on profiler-guided LLM code optimization, context selection for coding agents, and reuse of execution-grounded optimization experience, and what gap remains for bounded performance-aware context management?

## Planned sections

### 1. LLM-based code performance optimization

- Repository-level performance optimization benchmarks.
- Performance-oriented coding agents and automated program improvement.
- Correctness-preserving optimization evaluation.

### 2. Profiler-guided coding agents

- How profiler evidence is represented and supplied to an Agent.
- Whether prior systems distinguish hot code from editable/project-owned code.
- Whether context is ranked, filtered, or simply appended.

### 3. Context management for coding agents

- Context selection under a fixed budget.
- Code, call-graph, test, and execution-evidence retrieval.
- Differences between performance-aware selection and generic repository retrieval.

### 4. Learning from optimization outcomes

- Execution-grounded memory or experience reuse.
- Treatment of successful, ineffective, and correctness-regressing attempts.
- Boundaries between experience reuse, adaptive systems, and true self-evolution.

### 5. Performance benchmarks and evaluation methodology

- SWE-efficiency and related repository-level benchmarks.
- Runtime measurement, noise control, and cross-platform reproducibility.
- Correctness oracles and benchmark leakage risks.

### 6. Research-gap synthesis

This section must be written only after the literature review supports it. It should compare prior work against:

- explicit performance-evidence selection;
- editability and project ownership;
- bounded Top-K context construction;
- regression risk and tried-attempt penalties;
- experience grounded by real tests and benchmarks.

## Evidence table template

| Work | Task type | Agent/model | Profiler evidence | Context selection | Outcome-grounded reuse | Correctness oracle | Performance metric | Relevant limitation |
|---|---|---|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |

## Search and screening log

Record databases, queries, dates, inclusion/exclusion criteria, and citation status here before drawing conclusions.

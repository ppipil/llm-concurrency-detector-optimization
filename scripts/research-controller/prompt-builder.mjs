export const MECHANICAL_PROFILER_TOP_K = 8;

export const PERFORMANCE_CONTEXT_GUIDANCE = `The provided performance context is evidence for the current task, not a requirement to exhaustively analyze every item.
Use it to form a plausible optimization hypothesis.
Repeat expensive diagnostics only when needed to resolve a specific uncertainty.`;

export function buildAgentSystemPrompt() {
  return `You are the fixed experimental coding agent in an isolated repository on native Windows.
Follow the supplied AGENT CONTRACT, TASK, PERFORMANCE CONTEXT, and RUNNING / EXECUTION GUIDANCE.
Work only through the declared tools and within the current repository.
Complete the requested source-code performance optimization while preserving correctness.
Base claims on observed tool and test results. Stop when the task is complete or the fixed budget is exhausted.`;
}

function location(item) {
  return `${item.source_file}:${item.source_line ?? "?"}`;
}

function formatSeconds(value) {
  return Number.isFinite(value) ? `${value.toFixed(6)}s` : "n/a";
}

function formatCalls(value) {
  return Number.isFinite(value) ? String(value) : "n/a";
}

function isAgentSafeFrame(item) {
  const source = item.source_file.toLowerCase();
  return item.ownership !== "evaluator" &&
    !source.includes("timeit.py") &&
    !source.includes("runpy.py") &&
    !source.includes("timeit-src");
}

function descending(field) {
  return (left, right) => (right[field] ?? 0) - (left[field] ?? 0);
}

export function renderMechanicalProfilerEvidence(profileDocument, { topK = MECHANICAL_PROFILER_TOP_K } = {}) {
  if (!Number.isInteger(topK) || topK <= 0) throw new Error("topK must be a positive integer");

  const functions = profileDocument.profile.functions.filter(isAgentSafeFrame);
  const byId = new Map(functions.map((item) => [item.id, item]));
  const bySelf = [...functions].sort(descending("self_time_seconds")).slice(0, topK);
  const byCumulative = [...functions].sort(descending("cumulative_time_seconds")).slice(0, topK);
  const edges = profileDocument.profile.call_relationships
    .filter((edge) => byId.has(edge.caller_id) && byId.has(edge.callee_id))
    .sort(descending("cumulative_time_seconds"))
    .slice(0, topK);

  const symbols = new Map();
  const symbolFor = (item) => {
    if (!symbols.has(item.id)) symbols.set(item.id, `F${symbols.size + 1}`);
    return symbols.get(item.id);
  };
  for (const item of bySelf) symbolFor(item);
  for (const item of byCumulative) symbolFor(item);
  for (const edge of edges) {
    symbolFor(byId.get(edge.caller_id));
    symbolFor(byId.get(edge.callee_id));
  }

  const symbolLines = [...symbols.entries()].map(([id, symbol]) => {
    const item = byId.get(id);
    return `${symbol} ${item.function} @ ${location(item)}`;
  });
  const selfLines = bySelf.map((item, index) =>
    `${index + 1} ${symbolFor(item)} calls=${formatCalls(item.total_call_count)} self=${formatSeconds(item.self_time_seconds)} share=${item.runtime_share_percent.toFixed(2)}%`,
  );
  const cumulativeLines = byCumulative.map((item, index) =>
    `${index + 1} ${symbolFor(item)} calls=${formatCalls(item.total_call_count)} cumulative=${formatSeconds(item.cumulative_time_seconds)}`,
  );
  const edgeLines = edges.map((edge, index) =>
    `${index + 1} ${symbolFor(byId.get(edge.caller_id))}>${symbolFor(byId.get(edge.callee_id))} calls=${formatCalls(edge.total_call_count)} cumulative=${formatSeconds(edge.cumulative_time_seconds)}`,
  );

  const profilerName = profileDocument.profiler?.name ?? "cProfile";
  const profilerVersion = profileDocument.profiler?.version ? ` ${profileDocument.profiler.version}` : "";
  return `PROFILER EVIDENCE
source=${profilerName}${profilerVersion}; ordering=mechanical descending runtime; top_k=${topK}; profiling times include overhead and are not benchmark runtimes; evaluator and measurement-wrapper frames are filtered only for information-boundary safety.

SYMBOLS
${symbolLines.join("\n")}

SELF_TIME_TOP_${topK}
${selfLines.join("\n")}

CUMULATIVE_TIME_TOP_${topK}
${cumulativeLines.join("\n")}

CALL_EDGES_TOP_${topK}
${edgeLines.join("\n")}`;
}

export function buildAgentPrompt({ taskDescription, performanceContext = "", resourceControl, runClassification }) {
  if (!taskDescription?.trim()) throw new Error("taskDescription is required");
  if (!resourceControl) throw new Error("resourceControl is required");
  if (!runClassification?.trim()) throw new Error("runClassification is required");
  const contextBody = performanceContext.trim() || "(no pre-supplied performance evidence)";
  const { execution, toolSafety } = resourceControl;

  return `AGENT CONTRACT
- Complete one concrete source-code performance optimization and run relevant real tests before finishing.
- Preserve correctness and public behavior. Do not modify or weaken tests, benchmarks, or test infrastructure.
- Work only inside the current repository checkout and use only the declared tools. Do not read parent directories or external project/evaluator files.
- Use the existing .venv/Scripts/python.exe for Python commands on native Windows through Git Bash.
- Do not read evaluator-only files, hidden oracle data, expert or gold patches, gold-touched files, gold speedups, or post-edit reference results.
- Do not claim success from reasoning alone; report only observed results.
- Run classification: ${runClassification.trim()}.
- Execution budget: ${execution.toolCalls} tool calls; ${execution.modelTurns} model turns; ${execution.wallClockMs / 60000} minutes wall-clock.
- Bash commands receive a controller-enforced default timeout of ${toolSafety.bashDefaultTimeoutSeconds} seconds.

TASK
${taskDescription.trim()}

PERFORMANCE CONTEXT
${PERFORMANCE_CONTEXT_GUIDANCE}

${contextBody}

RUNNING / EXECUTION GUIDANCE
Use a short diagnose-act-validate cycle.

1. Inspect the relevant implementation and identify a plausible performance optimization.
2. Once you have a concrete, testable hypothesis, stop broad exploration. Do not continue searching merely to eliminate every theoretical uncertainty.
3. Make the smallest safe source-code patch and immediately run the most relevant targeted correctness test.
4. If the test passes, run the performance benchmark. If it fails, use the test output to refine the patch.
5. Never modify or weaken tests or benchmark definitions.
6. If a critical semantic question remains unresolved, perform only the focused check needed to address it.

Do not enlarge the formal workload's input sizes for expensive exploratory runs.
Do not claim improvement without measured results.`;
}

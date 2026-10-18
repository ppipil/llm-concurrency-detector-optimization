const DEFAULT_WEIGHTS = Object.freeze({
  runtimeImportance: 0.25,
  callFrequency: 0.10,
  taskCallRelevance: 0.30,
  editability: 0.20,
  testSupport: 0.15,
  regressionRisk: 0.10,
});

const STOP_WORDS = new Set([
  "about", "after", "again", "against", "also", "always", "and", "are", "because", "before",
  "benchmark", "code", "correctness", "current", "does", "from", "have", "into", "maintaining",
  "for", "main", "more", "most", "not", "only", "performance", "repository", "run", "should",
  "task", "that", "the", "their", "this", "through", "use", "using", "when", "where", "while",
  "with", "your",
]);

export const SELECTOR_VERSION = "performance-aware-context-mvp-v1";
export const SELECTOR_WEIGHTS = DEFAULT_WEIGHTS;

export function extractTaskFocus(taskDescription) {
  const lines = String(taskDescription ?? "").split(/\r?\n/u);
  const headingPriorities = ["initial observations?", "performance symptoms?", "task description"];
  for (const heading of headingPriorities) {
    const pattern = new RegExp(`^(?:#{1,6}\\s*|\\*\\*)?(?:${heading})(?:\\*\\*)?\\s*:?\\s*$`, "iu");
    for (let index = 0; index < lines.length; index += 1) {
      if (!pattern.test(lines[index].trim())) continue;
      const body = [];
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const line = lines[cursor];
        if (/^\s*(?:#{1,6}\s+|\*\*[^*]+\*\*\s*$)/u.test(line) && body.some((item) => item.trim())) break;
        body.push(line);
      }
      const focused = body.join("\n").trim();
      if (focused) return focused;
    }
  }
  return String(taskDescription ?? "").trim();
}

export function tokenize(value) {
  return [...new Set(String(value ?? "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9_]+/gu, " ")
    .split(/\s+/u)
    .flatMap((token) => token.split("_"))
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)))];
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function normalize(value, maximum) {
  return maximum > 0 ? clamp01(value / maximum) : 0;
}

function round(value) {
  return Number(value.toFixed(6));
}

function sourceLine(sourceFiles, item) {
  const source = sourceFiles[item.source_file];
  if (typeof source !== "string" || !Number.isInteger(item.source_line) || item.source_line < 1) return "";
  return source.split(/\r?\n/u)[item.source_line - 1]?.trim() ?? "";
}

function label(item) {
  return `${item.function} @ ${item.source_file}:${item.source_line ?? "?"}`;
}

function relatedTestsFor(keywords, testFiles) {
  if (keywords.length === 0) return [];
  return Object.entries(testFiles)
    .filter(([, content]) => {
      const tokens = new Set(tokenize(content));
      return keywords.some((keyword) => tokens.has(keyword));
    })
    .map(([path]) => path)
    .sort();
}

function compactSource(value, maximum = 180) {
  const compact = value.replaceAll(/\s+/gu, " ").trim();
  return compact.length <= maximum ? compact : `${compact.slice(0, maximum - 3)}...`;
}

function incidentRelationships(id, relationships, byId) {
  return relationships
    .filter((edge) => edge.caller_id === id || edge.callee_id === id)
    .map((edge) => ({
      direction: edge.caller_id === id ? "calls" : "called_by",
      peer_id: edge.caller_id === id ? edge.callee_id : edge.caller_id,
      peer: label(byId.get(edge.caller_id === id ? edge.callee_id : edge.caller_id)),
      calls: edge.total_call_count,
      cumulative_time_seconds: edge.cumulative_time_seconds ?? 0,
    }))
    .sort((left, right) => right.cumulative_time_seconds - left.cumulative_time_seconds);
}

export function rankPerformanceTargets({ profileDocument, taskDescription, sourceFiles, testFiles, weights = DEFAULT_WEIGHTS }) {
  const functions = profileDocument?.profile?.functions ?? [];
  const relationships = profileDocument?.profile?.call_relationships ?? [];
  const byId = new Map(functions.map((item) => [item.id, item]));
  const taskFocus = extractTaskFocus(taskDescription);
  const taskTokens = new Set(tokenize(taskFocus));
  const incoming = new Map();
  const outgoing = new Map();
  for (const edge of relationships) {
    incoming.set(edge.callee_id, (incoming.get(edge.callee_id) ?? 0) + 1);
    outgoing.set(edge.caller_id, (outgoing.get(edge.caller_id) ?? 0) + 1);
  }

  const preliminaries = functions.map((item) => {
    const line = sourceLine(sourceFiles, item);
    const candidateTokens = tokenize(`${item.function} ${item.source_file} ${line}`);
    const matchedTaskTerms = candidateTokens.filter((token) => taskTokens.has(token)).sort();
    const directRelevanceRaw = matchedTaskTerms.length / Math.sqrt(Math.max(1, candidateTokens.length));
    const selfShare = item.runtime_share_percent ?? 0;
    const cumulativeShare = item.cumulative_share_percent ?? 0;
    return {
      item,
      line,
      matchedTaskTerms,
      directRelevanceRaw,
      runtimeRaw: Math.max(selfShare, Math.min(100, cumulativeShare)),
      callsRaw: Math.log1p(item.total_call_count ?? 0),
      inDegree: incoming.get(item.id) ?? 0,
      outDegree: outgoing.get(item.id) ?? 0,
    };
  });

  const maxDirect = Math.max(0, ...preliminaries.map((entry) => entry.directRelevanceRaw));
  const directById = new Map(preliminaries.map((entry) => [entry.item.id, normalize(entry.directRelevanceRaw, maxDirect)]));
  const neighbors = new Map();
  for (const edge of relationships) {
    if (!neighbors.has(edge.caller_id)) neighbors.set(edge.caller_id, []);
    if (!neighbors.has(edge.callee_id)) neighbors.set(edge.callee_id, []);
    neighbors.get(edge.caller_id).push(edge.callee_id);
    neighbors.get(edge.callee_id).push(edge.caller_id);
  }
  const maxRuntime = Math.max(0, ...preliminaries.map((entry) => entry.runtimeRaw));
  const maxCalls = Math.max(0, ...preliminaries.map((entry) => entry.callsRaw));
  const maxDegree = Math.max(0, ...preliminaries.map((entry) => entry.inDegree + entry.outDegree));

  const enriched = preliminaries.map((entry) => {
    const direct = directById.get(entry.item.id) ?? 0;
    const propagated = Math.max(0, ...(neighbors.get(entry.item.id) ?? []).map((id) => (directById.get(id) ?? 0) * 0.5));
    const taskCallRelevance = Math.max(direct, propagated);
    const keywords = entry.matchedTaskTerms;
    const relatedTests = relatedTestsFor(keywords, testFiles);
    return { ...entry, direct, propagated, taskCallRelevance, relatedTests };
  });
  const maxTests = Math.max(0, ...enriched.map((entry) => entry.relatedTests.length));

  return enriched.map((entry) => {
    const features = {
      runtimeImportance: normalize(entry.runtimeRaw, maxRuntime),
      callFrequency: normalize(entry.callsRaw, maxCalls),
      taskCallRelevance: entry.taskCallRelevance,
      editability: entry.item.repository_owned && entry.line ? 1 : 0,
      testSupport: normalize(entry.relatedTests.length, maxTests),
      regressionRisk: normalize(entry.inDegree + entry.outDegree, maxDegree),
    };
    const score =
      weights.runtimeImportance * features.runtimeImportance +
      weights.callFrequency * features.callFrequency +
      weights.taskCallRelevance * features.taskCallRelevance +
      weights.editability * features.editability +
      weights.testSupport * features.testSupport -
      weights.regressionRisk * features.regressionRisk;
    const reasons = [];
    if (features.runtimeImportance >= 0.5) reasons.push("high measured runtime contribution");
    if (features.callFrequency >= 0.5) reasons.push("frequent execution");
    if (entry.direct > 0) reasons.push(`task terms at source: ${entry.matchedTaskTerms.join(", ")}`);
    else if (entry.propagated > 0) reasons.push("one-hop call relation to a task-matched frame");
    if (features.editability === 1) reasons.push("repository-owned source is directly editable");
    if (entry.relatedTests.length > 0) reasons.push(`${entry.relatedTests.length} related test file(s) discovered`);
    if (features.regressionRisk >= 0.5) reasons.push("higher call-graph centrality raises regression risk");
    return {
      rank: null,
      id: entry.item.id,
      function: entry.item.function,
      source_file: entry.item.source_file,
      source_line: entry.item.source_line,
      source: compactSource(entry.line),
      ownership: entry.item.ownership,
      repository_owned: entry.item.repository_owned,
      total_call_count: entry.item.total_call_count,
      self_time_seconds: entry.item.self_time_seconds,
      cumulative_time_seconds: entry.item.cumulative_time_seconds,
      runtime_share_percent: entry.item.runtime_share_percent,
      matched_task_terms: entry.matchedTaskTerms,
      related_tests: entry.relatedTests,
      relationships: incidentRelationships(entry.item.id, relationships, byId).slice(0, 3),
      features: Object.fromEntries(Object.entries(features).map(([key, value]) => [key, round(value)])),
      score: round(score),
      reasons,
      eligible: features.editability === 1,
    };
  }).sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

function renderTarget(target, index) {
  const tests = target.related_tests.slice(0, 3).join(", ") || "none mechanically identified";
  const relation = target.relationships[0]
    ? `${target.relationships[0].direction} ${target.relationships[0].peer} (${target.relationships[0].calls ?? "?"} calls)`
    : "no recorded caller-callee edge";
  return `TARGET ${index + 1} score=${target.score.toFixed(6)}
symbol=${target.function} @ ${target.source_file}:${target.source_line ?? "?"}
runtime=self ${target.self_time_seconds.toFixed(6)}s (${target.runtime_share_percent.toFixed(2)}%), cumulative ${target.cumulative_time_seconds.toFixed(6)}s, calls ${target.total_call_count}
features=runtime:${target.features.runtimeImportance} calls:${target.features.callFrequency} relevance:${target.features.taskCallRelevance} editable:${target.features.editability} tests:${target.features.testSupport} risk:${target.features.regressionRisk}
source=${target.source || "unavailable"}
call_relation=${relation}
related_tests=${tests}
selection_reason=${target.reasons.join("; ") || "mechanical weighted score"}`;
}

export function selectPerformanceContext({
  profileDocument,
  taskDescription,
  sourceFiles,
  testFiles,
  charBudget,
  maxTargets = 3,
  weights = DEFAULT_WEIGHTS,
}) {
  if (!Number.isInteger(charBudget) || charBudget < 512) throw new Error("charBudget must be an integer >= 512");
  const ranking = rankPerformanceTargets({ profileDocument, taskDescription, sourceFiles, testFiles, weights });
  const eligible = ranking.filter((target) => target.eligible);
  const header = `PERFORMANCE-AWARE CONTEXT
selector=${SELECTOR_VERSION}; ranking=deterministic weighted evidence; budget_chars=${charBudget}; profiler times include overhead and are not benchmark runtimes.
weights=runtime:${weights.runtimeImportance} calls:${weights.callFrequency} task_call_relevance:${weights.taskCallRelevance} editability:${weights.editability} test_support:${weights.testSupport} minus_risk:${weights.regressionRisk}
Use these selected targets as bounded evidence, not as a required patch location.`;
  let context = header;
  const selected = [];
  const excludedForBudget = [];
  for (const candidate of eligible.slice(0, Math.max(maxTargets * 3, maxTargets))) {
    if (selected.length >= maxTargets) break;
    const block = renderTarget(candidate, selected.length);
    const proposed = `${context}\n\n${block}`;
    if (proposed.length <= charBudget) {
      context = proposed;
      selected.push(candidate);
    } else {
      excludedForBudget.push(candidate.id);
    }
  }
  if (selected.length === 0) throw new Error("No eligible target fits the context budget");
  return {
    selector_version: SELECTOR_VERSION,
    budget: {
      character_limit: charBudget,
      characters_used: context.length,
      estimated_tokens_at_four_chars_per_token: Math.ceil(context.length / 4),
      token_estimate_method: "Pi-compatible deterministic approximation: 1 token per 4 characters",
    },
    weights,
    selected_target_ids: selected.map((target) => target.id),
    excluded_for_budget: excludedForBudget,
    context,
    ranking,
  };
}

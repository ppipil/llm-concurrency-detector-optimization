import assert from "node:assert/strict";
import test from "node:test";

import {
  MECHANICAL_PROFILER_TOP_K,
  PERFORMANCE_CONTEXT_GUIDANCE,
  buildAgentPrompt,
  buildAgentSystemPrompt,
  renderMechanicalProfilerEvidence,
} from "./prompt-builder.mjs";

const RESOURCE_CONTROL = {
  execution: { wallClockMs: 600_000, toolCalls: 20, modelTurns: 12 },
  toolSafety: { bashDefaultTimeoutSeconds: 60 },
};

const TASK = `# Performance task: example

Repository: \`owner/repo\`
Base commit: \`0123456789abcdef\`

A repository operation has measurable runtime overhead.
Improve its performance while preserving public behavior and correctness.`;

function profileFixture() {
  const functions = Array.from({ length: 12 }, (_, index) => ({
    id: `src/mod.py:${index + 1}:fn_${index}`,
    function: `fn_${index}`,
    source_file: "src/mod.py",
    source_line: index + 1,
    primitive_call_count: index + 1,
    total_call_count: (index + 1) * 10,
    self_time_seconds: 20 - index,
    cumulative_time_seconds: 20 + index,
    runtime_share_percent: 20 - index,
    ownership: "repository",
  }));
  functions.push({
    id: "evaluator.py:1:evaluator_frame",
    function: "evaluator_frame",
    source_file: "evaluator.py",
    source_line: 1,
    total_call_count: 1,
    self_time_seconds: 999,
    cumulative_time_seconds: 999,
    runtime_share_percent: 99,
    ownership: "evaluator",
  });
  functions.push({
    id: "C:/Python/Lib/timeit.py:1:timer_frame",
    function: "timer_frame",
    source_file: "C:/Python/Lib/timeit.py",
    source_line: 1,
    total_call_count: 1,
    self_time_seconds: 998,
    cumulative_time_seconds: 998,
    runtime_share_percent: 98,
    ownership: "external",
  });
  const call_relationships = Array.from({ length: 11 }, (_, index) => ({
    caller_id: functions[index].id,
    callee_id: functions[index + 1].id,
    total_call_count: 100 + index,
    cumulative_time_seconds: 50 - index,
  }));
  return {
    profiler: { name: "cProfile", version: "test" },
    profile: { functions, call_relationships },
  };
}

function build(performanceContext = "") {
  return buildAgentPrompt({
    taskDescription: TASK,
    performanceContext,
    resourceControl: RESOURCE_CONTROL,
    runClassification: "preliminary experiment",
  });
}

function numberedRows(evidence, heading, nextHeading) {
  const start = evidence.indexOf(`${heading}\n`) + heading.length + 1;
  const end = nextHeading ? evidence.indexOf(`\n\n${nextHeading}`, start) : evidence.length;
  return evidence.slice(start, end).split("\n").filter((line) => /^\d+ /u.test(line));
}

test("B0 and B1 share one prompt skeleton and differ only in performance context", () => {
  const evidence = renderMechanicalProfilerEvidence(profileFixture());
  const b0 = build();
  const b1 = build(evidence);

  assert.equal(b1.replace(evidence, "(no pre-supplied performance evidence)"), b0);
  for (const heading of ["AGENT CONTRACT", "TASK", "PERFORMANCE CONTEXT", "RUNNING / EXECUTION GUIDANCE"]) {
    assert.equal(b0.split(heading).length - 1, 1);
    assert.equal(b1.split(heading).length - 1, 1);
  }
});

test("B0 performance context is empty and contains no profiler evidence", () => {
  const b0 = build();
  assert.match(b0, /PERFORMANCE CONTEXT\n/u);
  assert.match(b0, /\(no pre-supplied performance evidence\)/u);
  assert.doesNotMatch(b0, /PROFILER EVIDENCE|cProfile|SELF_TIME_TOP_/u);
});

test("B1 adds only reproducible mechanical profiler evidence", () => {
  const evidence = renderMechanicalProfilerEvidence(profileFixture());
  const b1 = build(evidence);
  assert.match(b1, /source=cProfile test; ordering=mechanical descending runtime; top_k=8/u);
  assert.doesNotMatch(evidence, /editability|regression.risk|historical.gain|tried.penalty|priority/iu);
});

test("B1 evidence uses fixed Top-8 tables and a de-duplicated symbol table", () => {
  const evidence = renderMechanicalProfilerEvidence(profileFixture());
  assert.equal(MECHANICAL_PROFILER_TOP_K, 8);
  assert.equal(numberedRows(evidence, "SELF_TIME_TOP_8", "CUMULATIVE_TIME_TOP_8").length, 8);
  assert.equal(numberedRows(evidence, "CUMULATIVE_TIME_TOP_8", "CALL_EDGES_TOP_8").length, 8);
  assert.equal(numberedRows(evidence, "CALL_EDGES_TOP_8").length, 8);
  assert.doesNotMatch(evidence, /evaluator_frame|timer_frame|timeit\.py/u);
  for (let index = 0; index < 12; index += 1) {
    assert.equal((evidence.match(new RegExp(`fn_${index} @`, "gu")) ?? []).length, 1);
  }
  assert.doesNotMatch(evidence, /Top 20/u);
});

test("prompt includes the shared short diagnose-act-validate transition without turn hard-coding", () => {
  const combined = `${buildAgentSystemPrompt()}\n${build()}`;
  assert.doesNotMatch(combined, /Inspect before editing|Diagnose the bottleneck|After the necessary diagnosis/iu);
  assert.match(combined, /Use a short diagnose-act-validate cycle/u);
  assert.match(combined, /concrete, testable hypothesis, stop broad exploration/u);
  assert.match(combined, /smallest safe source-code patch and immediately run the most relevant targeted correctness test/u);
  assert.match(combined, /If the test passes, run the performance benchmark/u);
  assert.match(combined, /critical semantic question remains unresolved/u);
  assert.match(combined, /Do not claim improvement without measured results/u);
  assert.doesNotMatch(combined, /(?:turn|tool call)\s*(?:number|#)?\s*\d+.*(?:edit|patch)/iu);
  assert.ok(build().includes(PERFORMANCE_CONTEXT_GUIDANCE));
});

test("prompt states execution limits without an accounted-token action ceiling", () => {
  const prompt = build();
  assert.match(prompt, /Execution budget: 20 tool calls; 12 model turns; 10 minutes wall-clock/u);
  assert.doesNotMatch(prompt, /accounted tokens|token ceiling|60k|100k/iu);
});

test("gold and evaluator isolation remains in the shared contract", () => {
  const prompt = build();
  assert.match(prompt, /evaluator-only files/u);
  assert.match(prompt, /expert or gold patches/u);
  assert.match(prompt, /gold-touched files/u);
  assert.match(prompt, /gold speedups/u);
  assert.match(prompt, /post-edit reference results/u);
});

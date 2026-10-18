import assert from "node:assert/strict";
import test from "node:test";

import { extractTaskFocus, rankPerformanceTargets, selectPerformanceContext, tokenize } from "./performance-context-selector.mjs";

const profile = {
  profile: {
    functions: [
      { id: "repo/worker.py:10:hot_loop", function: "hot_loop", source_file: "repo/worker.py", source_line: 10, total_call_count: 1000, self_time_seconds: 4, cumulative_time_seconds: 5, runtime_share_percent: 40, cumulative_share_percent: 50, ownership: "repository", repository_owned: true },
      { id: "repo/math_ops.py:20:<lambda>", function: "<lambda>", source_file: "repo/math_ops.py", source_line: 20, total_call_count: 100, self_time_seconds: 1, cumulative_time_seconds: 3, runtime_share_percent: 10, cumulative_share_percent: 30, ownership: "repository", repository_owned: true },
      { id: "external/native.py:1:dispatch", function: "dispatch", source_file: "external/native.py", source_line: 1, total_call_count: 5000, self_time_seconds: 5, cumulative_time_seconds: 8, runtime_share_percent: 50, cumulative_share_percent: 80, ownership: "external_dependency", repository_owned: false },
    ],
    call_relationships: [
      { caller_id: "repo/worker.py:10:hot_loop", callee_id: "repo/math_ops.py:20:<lambda>", total_call_count: 100, cumulative_time_seconds: 3 },
      { caller_id: "repo/math_ops.py:20:<lambda>", callee_id: "external/native.py:1:dispatch", total_call_count: 100, cumulative_time_seconds: 2 },
    ],
  },
};
const sources = {
  "repo/worker.py": `${"\n".repeat(9)}def hot_loop(values): return downstream(values)`,
  "repo/math_ops.py": `${"\n".repeat(19)}register_gradient(lambda result, value: expensive_transform(value))`,
};
const tests = {
  "tests/test_math_ops.py": "def test_expensive_transform_gradient(): pass",
  "tests/test_unrelated.py": "def test_parser(): pass",
};
const task = "Reduce the repeated expensive transform used by gradient evaluation without changing results.";

test("tokenize is deterministic and removes generic stop words", () => {
  assert.deepEqual(tokenize("The repeated_transform, repeated transform!"), ["repeated", "transform"]);
  assert.deepEqual(tokenize("for values not used when copying"), ["values", "used", "copying"]);
});

test("task focus deterministically prefers an explicit performance symptom section", () => {
  const document = "**Task Description**\nOptimize the repository.\n\n**Initial Observations**\nRepeated conversion is slow.\n\n**Relevant Issues**\nUnrelated issue text.";
  assert.equal(extractTaskFocus(document), "Repeated conversion is slow.");
  assert.equal(extractTaskFocus("Plain task without sections."), "Plain task without sections.");
});

test("selector ranks a task-matched editable source above a hotter external frame", () => {
  const ranking = rankPerformanceTargets({ profileDocument: profile, taskDescription: task, sourceFiles: sources, testFiles: tests });
  assert.equal(ranking[0].source_file, "repo/math_ops.py");
  assert.equal(ranking[0].eligible, true);
  assert.ok(ranking[0].matched_task_terms.includes("gradient"));
  assert.deepEqual(ranking[0].related_tests, ["tests/test_math_ops.py"]);
  assert.equal(ranking.find((item) => item.source_file === "external/native.py").eligible, false);
});

test("one-hop call relation propagates task relevance without semantic special cases", () => {
  const ranking = rankPerformanceTargets({ profileDocument: profile, taskDescription: task, sourceFiles: sources, testFiles: tests });
  const caller = ranking.find((item) => item.function === "hot_loop");
  assert.ok(caller.features.taskCallRelevance > 0);
  assert.ok(caller.reasons.includes("one-hop call relation to a task-matched frame"));
});

test("context respects the fixed budget and preserves ranking audit", () => {
  const result = selectPerformanceContext({ profileDocument: profile, taskDescription: task, sourceFiles: sources, testFiles: tests, charBudget: 1600, maxTargets: 3 });
  assert.ok(result.context.length <= 1600);
  assert.equal(result.budget.characters_used, result.context.length);
  assert.equal(result.ranking.length, 3);
  assert.ok(result.selected_target_ids.length >= 1);
  assert.match(result.context, /features=runtime:/u);
  assert.match(result.context, /selection_reason=/u);
});

test("selector is deterministic for identical inputs", () => {
  const input = { profileDocument: profile, taskDescription: task, sourceFiles: sources, testFiles: tests, charBudget: 1600 };
  assert.deepEqual(selectPerformanceContext(input), selectPerformanceContext(input));
});

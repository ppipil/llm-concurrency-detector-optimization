import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const experimentDir = resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("Usage: node summarize-m5d.mjs <experiment-dir>");

async function loadJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function groupRecord(group) {
  const directory = join(experimentDir, group);
  const summary = await loadJson(join(directory, "summary.json"));
  const events = (await readFile(join(directory, "events.jsonl"), "utf8")).split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
  const firstEdit = events.find((event) => event.type === "tool_execution_start" && ["edit", "write"].includes(event.toolName));
  const firstEditEnd = firstEdit ? events.find((event) => event.type === "tool_execution_end" && event.toolCallId === firstEdit.toolCallId) : null;
  const bashStarts = events.filter((event) => event.type === "tool_execution_start" && event.toolName === "bash");
  const sourcePatchFiles = summary.repository.sourcePatchFiles ?? [];
  const targetedTests = summary.agent.agentDrivenTests ?? [];
  return {
    group,
    treatment: group === "B0" ? "vanilla" : "profiler-guided",
    termination_reason: summary.terminationReason,
    outcome: sourcePatchFiles.length ? "PATCH_PRODUCED" : "NO_PATCH",
    time_to_first_edit_ms: firstEdit?.atMs ?? null,
    first_edit_completed: Boolean(firstEditEnd) && !firstEditEnd.isError,
    first_edit_result: firstEditEnd?.result?.text ?? null,
    targeted_test_run: targetedTests.length > 0,
    targeted_tests: targetedTests,
    tokens: summary.agent.stats.tokens,
    tool_calls: summary.agent.stats.toolCalls,
    turns: summary.agent.assistantMessages,
    wall_clock_ms: summary.elapsedMs,
    tool_sequence: summary.agent.toolSequence,
    source_patch_files: sourcePatchFiles,
    bash_timeout_injection: {
      calls: bashStarts.length,
      injected: bashStarts.filter((event) => event.controllerDefaults?.timeoutInjected).length,
      effective_seconds: [...new Set(bashStarts.map((event) => event.controllerDefaults?.bashTimeoutSeconds))],
    },
    evaluator: sourcePatchFiles.length ? "REQUIRED" : "SKIPPED_NO_PATCH",
  };
}

const b0 = await groupRecord("B0");
const b1 = await groupRecord("B1");
const completedLoop = (record) => record.outcome === "PATCH_PRODUCED" && record.targeted_test_run;
const aggregate = {
  schema_version: 1,
  experiment: "M5d FAST sanity check",
  formal_experiment: false,
  protocol: "fast-sanity-v1",
  sanity_result: completedLoop(b0) && completedLoop(b1) ? "PASS" : "FAIL",
  groups: { B0: b0, B1: b1 },
  supports_20228_task_specific_failure: completedLoop(b0) || completedLoop(b1),
  can_enter_m6: completedLoop(b0) && completedLoop(b1),
  interpretation: "B0 diagnosed a concrete change and attempted edit at its eighth-turn boundary, but the controller aborted that tool execution while enforcing the turn limit. B1 never attempted edit. Neither reached targeted test, so the evidence does not isolate sympy__sympy-20228 as the cause of earlier failures.",
};
await writeFile(join(experimentDir, "aggregate.json"), `${JSON.stringify(aggregate, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ sanityResult: aggregate.sanity_result, supportsTaskSpecificFailure: aggregate.supports_20228_task_specific_failure, canEnterM6: aggregate.can_enter_m6 }, null, 2));

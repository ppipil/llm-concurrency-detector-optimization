import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const experimentDir = resolve(process.argv[2] ?? "");
const outputDir = resolve(process.argv[3] ?? experimentDir);
if (!process.argv[2]) throw new Error("Usage: node summarize-m5c.mjs <experiment-dir> [output-dir]");

async function loadJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function loadEvents(path) {
  return (await readFile(path, "utf8")).split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
}

async function groupRecord(group) {
  const directory = join(experimentDir, group);
  const summary = await loadJson(join(directory, "summary.json"));
  const events = await loadEvents(join(directory, "events.jsonl"));
  const starts = events.filter((event) => event.type === "tool_execution_start" && event.toolName === "bash");
  const ends = events.filter((event) => event.type === "tool_execution_end" && event.toolName === "bash");
  const durations = starts.map((start) => {
    const end = ends.find((candidate) => candidate.toolCallId === start.toolCallId);
    return end ? end.atMs - start.atMs : null;
  }).filter((value) => value !== null);
  const sourcePatchFiles = summary.repository.sourcePatchFiles ?? [];
  return {
    group,
    treatment: group === "B0" ? "vanilla" : "profiler-guided",
    directory,
    termination_reason: summary.terminationReason,
    attempt_outcome: sourcePatchFiles.length > 0 ? "PATCH_PRODUCED" : "NO_PATCH",
    elapsed_ms: summary.elapsedMs,
    tokens: summary.agent.stats.tokens,
    tool_calls: summary.agent.stats.toolCalls,
    turns: summary.modelTurns ?? summary.agent.assistantMessages,
    tool_sequence: summary.agent.toolSequence,
    agent_driven_tests: summary.agent.agentDrivenTests,
    changed_files: summary.repository.changedFiles,
    source_patch_files: sourcePatchFiles,
    bash_policy: {
      calls: starts.length,
      controller_injected_calls: starts.filter((event) => event.controllerDefaults?.timeoutInjected).length,
      effective_timeouts_seconds: [...new Set(starts.map((event) => event.controllerDefaults?.bashTimeoutSeconds))],
      observed_timeout_results: ends.filter((event) => event.result?.text?.includes("timed out")).length,
      maximum_observed_call_ms: durations.length ? Math.max(...durations) : null,
    },
    evaluator: sourcePatchFiles.length > 0 ? "REQUIRED" : "SKIPPED_NO_PATCH",
  };
}

const b0 = await groupRecord("B0");
const b1 = await groupRecord("B1");
const protocolValidated = [b0, b1].every((record) =>
  record.bash_policy.calls === record.bash_policy.controller_injected_calls &&
  record.bash_policy.effective_timeouts_seconds.every((timeout) => timeout === 60) &&
  !record.termination_reason.startsWith("model_error:"),
);
const anyPatch = b0.source_patch_files.length > 0 || b1.source_patch_files.length > 0;
const aggregate = {
  schema_version: 1,
  experiment: "M5c frozen Agent execution protocol validation",
  execution_protocol: "agent-execution-v1",
  protocol_validation: protocolValidated ? "PASS" : "FAIL",
  m5_status: anyPatch ? "REQUIRES_EVALUATION_REVIEW" : "PARTIAL",
  groups: { B0: b0, B1: b1 },
  notes: [
    "The 100k token limiter is evaluated at completed assistant-message boundaries and can overshoot by one response.",
    "Generated profiler captures are not source patches.",
    "No full M3 evaluator is run for NO_PATCH attempts.",
  ],
};

const row = (record) => `| ${record.group} | ${record.termination_reason} | ${record.attempt_outcome} | ${record.agent_driven_tests.length ? "yes" : "no"} | ${record.tokens.total} | ${record.tool_calls} | ${record.turns} | ${(record.elapsed_ms / 1000).toFixed(3)} s | ${record.bash_policy.calls}/${record.bash_policy.controller_injected_calls} |`;
const markdown = `# M5c Frozen Execution Protocol Summary

**Protocol validation: ${aggregate.protocol_validation}**  
**M5 status: ${aggregate.m5_status}**

| Group | Termination | Source patch | Agent tests | Tokens | Tools | Turns | Wall-clock | Bash injected |
|---|---|---|---|---:|---:|---:|---:|---:|
${row(b0)}
${row(b1)}

B0's longest bash call was ${(b0.bash_policy.maximum_observed_call_ms / 1000).toFixed(3)} seconds and was terminated by the controller-injected 60-second timeout. B1's longest bash call was ${(b1.bash_policy.maximum_observed_call_ms / 1000).toFixed(3)} seconds. Neither group produced a source patch or ran targeted tests, so both are unsuccessful \`NO_PATCH\` attempts and the full M3 benchmark was skipped.
`;

await mkdir(outputDir, { recursive: true });
await writeFile(join(outputDir, "aggregate.json"), `${JSON.stringify(aggregate, null, 2)}\n`, "utf8");
await writeFile(join(outputDir, "summary.md"), markdown, "utf8");
console.log(JSON.stringify({ protocolValidation: aggregate.protocol_validation, m5Status: aggregate.m5_status, outputDir }, null, 2));

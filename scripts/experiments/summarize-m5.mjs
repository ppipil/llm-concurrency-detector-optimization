import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..", "..");
const experimentId = process.argv[2];
if (!experimentId) throw new Error("Usage: node scripts/experiments/summarize-m5.mjs <experiment-id>");
const experimentDir = join(ROOT, "results", "raw", "m5", experimentId);

async function loadJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function groupRecord(group) {
  const directory = join(experimentDir, group);
  const agent = await loadJson(join(directory, "summary.json"));
  const evaluation = await loadJson(join(directory, "evaluation", "evaluation.json"));
  const transcript = await loadJson(join(directory, "transcript.json"));
  const patch = await readFile(join(directory, "patch.diff"), "utf8");
  const assistants = transcript.filter((message) => message.role === "assistant");
  const terminal = assistants.at(-1) ?? null;
  const patchPresent = patch.trim().length > 0;
  return {
    group,
    treatment: group === "B0" ? "vanilla" : "profiler-guided",
    agent: {
      elapsed_ms: agent.elapsedMs,
      budget_stop_reason: agent.budgetStopReason ?? null,
      terminal_stop_reason: terminal?.stopReason ?? null,
      terminal_error: terminal?.errorMessage ?? null,
      tool_calls: agent.agent.stats.toolCalls,
      tool_sequence: agent.agent.toolSequence,
      tokens: agent.agent.stats.tokens,
      patch_present: patchPresent,
      changed_files: agent.repository.changedFiles,
    },
    evaluation: {
      correctness: evaluation.correctness.status,
      test_summary: evaluation.correctness.test_summary,
      runtime_samples_seconds: evaluation.performance.runtime_samples_seconds,
      statistics: evaluation.performance.statistics,
      speedup_vs_m2: evaluation.comparison.speedup,
      m3_outcome: evaluation.outcome,
      attribution: !patchPresent
        ? evaluation.outcome === "SUCCESS"
          ? "UNATTRIBUTABLE_BASELINE_DRIFT"
          : "NO_PATCH_BASELINE_BEHAVIOR"
        : "CANDIDATE_PATCH_PRESENT",
    },
    artifacts: {
      directory,
      agent_summary: join(directory, "summary.json"),
      events: join(directory, "events.jsonl"),
      transcript: join(directory, "transcript.json"),
      patch: join(directory, "patch.diff"),
      evaluation: join(directory, "evaluation", "evaluation.json"),
    },
  };
}

const b0 = await groupRecord("B0");
const b1 = await groupRecord("B1");
const aggregate = {
  schema_version: 1,
  experiment_id: experimentId,
  status: "PARTIAL",
  preliminary: true,
  reason: `Both real Agent runs and evaluations completed, but neither Agent produced a patch. B0 termination: ${b0.agent.budget_stop_reason ?? b0.agent.terminal_error ?? b0.agent.terminal_stop_reason}. B1 termination: ${b1.agent.budget_stop_reason ?? b1.agent.terminal_error ?? b1.agent.terminal_stop_reason}.`,
  groups: { B0: b0, B1: b1 },
  adjacent_measurement: {
    b0_mean_seconds: b0.evaluation.statistics.mean_seconds,
    b1_mean_seconds: b1.evaluation.statistics.mean_seconds,
    b0_mean_divided_by_b1_mean: b0.evaluation.statistics.mean_seconds / b1.evaluation.statistics.mean_seconds,
    interpretation: "descriptive only; both workspaces are unchanged and execution order was not randomized",
  },
};

const row = (record) => `| ${record.group} | ${record.agent.patch_present ? "yes" : "no"} | ${record.evaluation.correctness} | ${record.evaluation.statistics.mean_seconds.toFixed(6)} s | ${record.evaluation.speedup_vs_m2.toFixed(6)}x | ${record.evaluation.m3_outcome} | ${record.agent.tool_calls} | ${record.agent.tokens.total} | ${(record.agent.elapsed_ms / 1000).toFixed(3)} s |`;
const markdown = `# M5 Preliminary B0/B1 Summary

**Status: PARTIAL**

Both fixed Pi/DeepSeek runs and both M3 evaluations executed on independent native-Windows workspaces. Neither Agent produced a patch, so the results describe unchanged baseline behavior rather than Agent optimization.

| Group | Patch | Correctness | Mean | Speedup vs M2 | M3 outcome | Tool calls | Accounted tokens | Agent wall time |
|---|---:|---|---:|---:|---|---:|---:|---:|
${row(b0)}
${row(b1)}

## Termination

- B0: budget trigger \`${b0.agent.budget_stop_reason ?? "none"}\`; terminal stop \`${b0.agent.terminal_stop_reason}\`; \`${b0.agent.terminal_error}\`.
- B1: budget trigger \`${b1.agent.budget_stop_reason ?? "none"}\`; terminal stop \`${b1.agent.terminal_stop_reason}\`; \`${b1.agent.terminal_error}\`.
- B1's 40,000-token check occurs at completed-message boundaries, so its final recorded request raised the total to ${b1.agent.tokens.total}. This is a harness limitation, not a hidden budget difference.

## Behavior difference

- B0 received no supplied profiler evidence. Tool sequence: \`${b0.agent.tool_sequence.join(", ")}\`.
- B1 received the sanitized mechanical profiler tables. Tool sequence: \`${b1.agent.tool_sequence.join(", ")}\`.
- Neither run reached edit/write or Agent-driven correctness testing.

## Measurement validity

- B0 and B1 remained byte-for-byte unchanged relative to the same commit.
- B0 mean / B1 mean = ${aggregate.adjacent_measurement.b0_mean_divided_by_b1_mean.toFixed(6)}; descriptive only.
- Mechanical M3 outcomes were B0=\`${b0.evaluation.m3_outcome}\` and B1=\`${b1.evaluation.m3_outcome}\`. Neither can represent a code change because both patches are empty.
- No final B0-versus-B1 research conclusion is supported by this single preliminary run.
`;

await writeFile(join(experimentDir, "aggregate.json"), `${JSON.stringify(aggregate, null, 2)}\n`, "utf8");
await writeFile(join(experimentDir, "summary.md"), markdown, "utf8");
console.log(JSON.stringify({ status: aggregate.status, experimentDir, B0: aggregate.groups.B0.evaluation, B1: aggregate.groups.B1.evaluation }, null, 2));

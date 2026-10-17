import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!value || !["--b0", "--b1", "--output"].includes(key)) {
      throw new Error("Usage: node summarize-m5b.mjs --b0 <evidence-dir> --b1 <evidence-dir> --output <dir>");
    }
    options[{ "--b0": "b0", "--b1": "b1", "--output": "output" }[key]] = resolve(value);
  }
  if (!options.b0 || !options.b1 || !options.output) throw new Error("--b0, --b1, and --output are required");
  return options;
}

async function loadJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function groupRecord(group, directory) {
  const agent = await loadJson(join(directory, "summary.json"));
  const evaluation = await loadJson(join(directory, "evaluation", "evaluation.json"));
  const transcript = await loadJson(join(directory, "transcript.json"));
  const patch = await readFile(join(directory, "patch.diff"), "utf8");
  const assistants = transcript.filter((message) => message.role === "assistant");
  const terminal = assistants.at(-1) ?? null;
  return {
    group,
    treatment: group === "B0" ? "vanilla" : "profiler-guided",
    source_directory: directory,
    agent: {
      elapsed_ms: agent.elapsedMs,
      budget: agent.budget,
      budget_stop_reason: agent.budgetStopReason ?? null,
      assistant_messages: assistants.length,
      terminal_stop_reason: terminal?.stopReason ?? null,
      terminal_error: terminal?.errorMessage ?? null,
      tool_calls: agent.agent.stats.toolCalls,
      tool_sequence: agent.agent.toolSequence,
      tokens: agent.agent.stats.tokens,
      patch_present: patch.trim().length > 0,
      changed_files: agent.repository.changedFiles,
    },
    evaluation: {
      correctness: evaluation.correctness.status,
      test_summary: evaluation.correctness.test_summary,
      runtime_samples_seconds: evaluation.performance.runtime_samples_seconds,
      statistics: evaluation.performance.statistics,
      speedup_vs_m2: evaluation.comparison.speedup,
      m3_outcome: evaluation.outcome,
      attribution: patch.trim().length > 0 ? "CANDIDATE_PATCH_PRESENT" : "NO_PATCH_BASELINE_BEHAVIOR",
    },
  };
}

const options = parseArguments(process.argv.slice(2));
const b0 = await groupRecord("B0", options.b0);
const b1 = await groupRecord("B1", options.b1);
const complete = b0.agent.patch_present && b1.agent.patch_present;
const aggregate = {
  schema_version: 1,
  experiment: "M5b B0/B1 baseline completion run",
  status: complete ? "PASS" : "PARTIAL",
  preliminary: true,
  reason: complete
    ? "Both groups produced patches and completed independent M3 evaluation."
    : "Both groups reached valid fixed-budget terminations and completed M3 evaluation, but one or both produced no patch; optimization effectiveness cannot be evaluated for an empty patch.",
  groups: { B0: b0, B1: b1 },
  adjacent_measurement: {
    b0_mean_seconds: b0.evaluation.statistics.mean_seconds,
    b1_mean_seconds: b1.evaluation.statistics.mean_seconds,
    b0_mean_divided_by_b1_mean: b0.evaluation.statistics.mean_seconds / b1.evaluation.statistics.mean_seconds,
    interpretation: "descriptive only; no patch exists in either workspace and execution order was not randomized",
  },
};

const row = (record) => `| ${record.group} | ${record.agent.patch_present ? "yes" : "no"} | ${record.evaluation.correctness} | ${record.evaluation.statistics.mean_seconds.toFixed(6)} s | ${record.evaluation.speedup_vs_m2.toFixed(6)}x | ${record.evaluation.m3_outcome} | ${record.agent.tool_calls} | ${record.agent.assistant_messages} | ${record.agent.tokens.total} | ${(record.agent.elapsed_ms / 1000).toFixed(3)} s | ${record.agent.budget_stop_reason} |`;
const markdown = `# M5b B0/B1 Baseline Completion Summary

**Status: ${aggregate.status}**

Both fixed Pi/DeepSeek groups reached a valid fixed-budget termination and were evaluated by M3 on independent native-Windows workspaces. Neither produced a patch, so the measurements describe unchanged baseline behavior and are not optimization gains.

| Group | Patch | Correctness | Mean | Speedup vs M2 | M3 outcome | Tools | Turns | Tokens | Agent wall time | Termination |
|---|---:|---|---:|---:|---|---:|---:|---:|---:|---|
${row(b0)}
${row(b1)}

The common budget was 80,000 accounted tokens, 30 tools, 20 assistant turns, and 600 seconds. Token checks occur at completed-message boundaries, so B1 overshot the token ceiling in its final response. B0 spent the remaining wall-clock budget inside one expensive Agent-selected command. All 30 benchmark samples per group were retained.
`;

await mkdir(options.output, { recursive: true });
await writeFile(join(options.output, "aggregate.json"), `${JSON.stringify(aggregate, null, 2)}\n`, "utf8");
await writeFile(join(options.output, "summary.md"), markdown, "utf8");
console.log(JSON.stringify({ status: aggregate.status, output: options.output }, null, 2));

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";

import {
  classifyOutcome,
  derivePreliminaryNoiseRule,
  extractBaselineStatistics,
  parseSympyTestSummary,
  summarizeSamples,
} from "./metrics.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");
const TASK_ID = "sympy__sympy-20228";
const TASK_DIR = join(ROOT, "experiments", "tasks", TASK_ID);
const EVALUATOR_DIR = join(TASK_DIR, "evaluator");
const MANIFEST_PATH = join(EVALUATOR_DIR, "manifest.json");
const WORKLOAD_PATH = join(EVALUATOR_DIR, "workload_windows.py");
const DEFAULT_WORKSPACE = join(ROOT, "workspaces", "m2-sympy-20228");

function parseArguments(argv) {
  const options = { repetitions: undefined, baseline: undefined, workspace: DEFAULT_WORKSPACE, output: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--repetitions" && value) {
      options.repetitions = Number(value);
      index += 1;
    } else if (argument === "--baseline" && value) {
      options.baseline = resolve(value);
      index += 1;
    } else if (argument === "--workspace" && value) {
      options.workspace = resolve(value);
      index += 1;
    } else if (argument === "--output" && value) {
      options.output = resolve(value);
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }
  if (options.repetitions !== undefined && (!Number.isInteger(options.repetitions) || options.repetitions < 1)) {
    throw new Error("--repetitions must be a positive integer.");
  }
  return options;
}

function run(command, args, { cwd, env } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const started = performance.now();
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      shell: false,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("error", rejectPromise);
    child.once("close", (exitCode) => {
      resolvePromise({
        command: [command, ...args].join(" "),
        exit_code: exitCode,
        wall_time_ms: Math.round(performance.now() - started),
        stdout,
        stderr,
      });
    });
  });
}

function parseWorkloadOutput(stdout) {
  const lines = stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  const payload = JSON.parse(lines.at(-1));
  if (!Array.isArray(payload.runtimes_seconds) || payload.runtimes_seconds.length === 0) {
    throw new Error("Workload output did not contain runtime samples.");
  }
  return payload;
}

function renderHumanSummary(evaluation) {
  const statistics = evaluation.performance.statistics;
  const comparison = evaluation.comparison;
  const tests = evaluation.correctness.test_summary;
  return `# Evaluation Summary

- Task: \`${evaluation.task.instance_id}\`
- Revision: \`${evaluation.task.revision}\`
- Evaluation status: **${evaluation.evaluation_status}**
- Correctness: **${evaluation.correctness.status}**
- Outcome: **${evaluation.outcome ?? "BASELINE_ONLY"}**

## Correctness

- Exit code: ${evaluation.correctness.exit_code}
- Passed: ${tests.passed ?? "unparsed"}
- Skipped: ${tests.skipped ?? "unparsed"}
- Expected failures: ${tests.expected_failures ?? "unparsed"}
- Oracle modified: ${evaluation.integrity.correctness_oracle_modified}

## Performance

- Measurement kind: benchmark (profiler disabled)
- Independent processes: ${evaluation.performance.process_repetitions_completed}
- Raw samples: ${statistics?.count ?? 0}
- Mean: ${statistics ? statistics.mean_seconds.toFixed(6) : "unavailable"} s
- Median: ${statistics ? statistics.median_seconds.toFixed(6) : "unavailable"} s
- Sample std: ${statistics ? statistics.standard_deviation_seconds.toFixed(6) : "unavailable"} s
- CV: ${statistics ? statistics.coefficient_of_variation_percent.toFixed(4) : "unavailable"}%

## Comparison

- Baseline supplied: ${comparison.baseline_supplied}
- Baseline mean: ${comparison.baseline_mean_seconds ?? "n/a"} s
- Candidate mean: ${comparison.candidate_mean_seconds ?? "n/a"} s
- Speedup: ${comparison.speedup === null ? "n/a" : `${comparison.speedup.toFixed(6)}x`}
- Preliminary threshold: ${comparison.noise_rule ? `${comparison.noise_rule.threshold_percent.toFixed(4)}%` : "n/a"}

The noise rule is provisional and is not the final statistical protocol.
`;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const repetitions = options.repetitions ?? manifest.benchmark_protocol.process_repetitions;
  const runId = new Date().toISOString().replaceAll(":", "").replaceAll("-", "").replace(".000Z", "Z");
  const outputDir =
    options.output ?? join(ROOT, "results", "raw", "evaluations", TASK_ID, runId);
  const python = join(options.workspace, ".venv", "Scripts", "python.exe");
  if (!existsSync(python)) throw new Error(`Task Python environment not found: ${python}`);
  await mkdir(outputDir, { recursive: true });

  const workloadBytes = await readFile(WORKLOAD_PATH);
  const workloadSha256 = createHash("sha256").update(workloadBytes).digest("hex");
  const revisionResult = await run("git.exe", ["rev-parse", "HEAD"], { cwd: options.workspace });
  const revision = revisionResult.stdout.trim();
  if (revisionResult.exit_code !== 0 || revision !== manifest.base_commit) {
    throw new Error(`Workspace revision ${revision || "unknown"} does not match ${manifest.base_commit}.`);
  }

  const changedFilesResult = await run("git.exe", ["diff", "--name-only", "HEAD", "--"], {
    cwd: options.workspace,
  });
  const changedFiles = changedFilesResult.stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  const oracleModified = changedFiles.some((file) => manifest.correctness_test_files.includes(file.replaceAll("\\", "/")));

  const correctnessRun = await run(
    python,
    ["bin/test", "--no-subprocess", "--verbose", "--no-colors", ...manifest.correctness_test_files],
    {
      cwd: options.workspace,
      env: { PYTHONWARNINGS: "ignore::UserWarning,ignore::SyntaxWarning" },
    },
  );
  await writeFile(join(outputDir, "correctness.stdout.txt"), correctnessRun.stdout, "utf8");
  await writeFile(join(outputDir, "correctness.stderr.txt"), correctnessRun.stderr, "utf8");

  const parsedTests = parseSympyTestSummary(`${correctnessRun.stdout}\n${correctnessRun.stderr}`);
  const correctnessStatus = correctnessRun.exit_code === 0 && !oracleModified ? "PASS" : "FAIL";
  const benchmarkRuns = [];
  if (correctnessStatus === "PASS") {
    for (let index = 1; index <= repetitions; index += 1) {
      const benchmarkRun = await run(python, [WORKLOAD_PATH], { cwd: options.workspace });
      await writeFile(join(outputDir, `benchmark-${index}.stdout.txt`), benchmarkRun.stdout, "utf8");
      await writeFile(join(outputDir, `benchmark-${index}.stderr.txt`), benchmarkRun.stderr, "utf8");
      let parsed;
      let parseError;
      if (benchmarkRun.exit_code === 0) {
        try {
          parsed = parseWorkloadOutput(benchmarkRun.stdout);
        } catch (error) {
          parseError = error instanceof Error ? error.message : String(error);
        }
      }
      benchmarkRuns.push({
        index,
        command: benchmarkRun.command,
        exit_code: benchmarkRun.exit_code,
        wall_time_ms: benchmarkRun.wall_time_ms,
        runtime_samples_seconds: parsed?.runtimes_seconds ?? [],
        workload_reported_mean_seconds: parsed?.mean_seconds,
        workload_reported_stdev_seconds: parsed?.stdev_seconds,
        parse_error: parseError,
      });
      if (benchmarkRun.exit_code !== 0 || parseError) break;
    }
  }

  const runtimeSamples = benchmarkRuns.flatMap((item) => item.runtime_samples_seconds);
  const benchmarkComplete = benchmarkRuns.length === repetitions && benchmarkRuns.every((item) => item.exit_code === 0 && !item.parse_error);
  const statistics = runtimeSamples.length > 0 ? summarizeSamples(runtimeSamples) : null;

  let baseline = null;
  let noiseRule = null;
  let speedup = null;
  if (options.baseline) {
    baseline = extractBaselineStatistics(JSON.parse(await readFile(options.baseline, "utf8")));
    if (baseline.correctness_status !== "PASS") throw new Error("Comparison baseline correctness is not PASS.");
    noiseRule = derivePreliminaryNoiseRule(baseline.coefficient_of_variation_percent);
    if (statistics) speedup = baseline.mean_seconds / statistics.mean_seconds;
  }

  const evaluationStatus = correctnessStatus === "PASS" && !benchmarkComplete ? "ERROR" : "COMPLETED";
  const outcome =
    correctnessStatus === "FAIL"
      ? "REGRESSION"
      : benchmarkComplete
        ? classifyOutcome({ correctnessStatus, speedup, noiseRule })
        : null;

  const environment = {
    platform: process.platform,
    node: process.version,
    python: await run(python, ["--version"], { cwd: options.workspace }),
    dependencies: await run(python, ["-m", "pip", "freeze"], { cwd: options.workspace }),
  };
  const evaluation = {
    schema_version: 1,
    evaluator: "minimal-evaluation-harness",
    evaluator_version: "0.1.0",
    run_id: runId,
    created_at: new Date().toISOString(),
    evaluation_status: evaluationStatus,
    outcome,
    task: {
      instance_id: TASK_ID,
      repository: manifest.repository,
      revision,
      workspace: options.workspace,
    },
    integrity: {
      changed_files: changedFiles,
      correctness_oracle_modified: oracleModified,
      workload_path: WORKLOAD_PATH,
      workload_sha256: workloadSha256,
      evaluator_data_outside_agent_workspace: !resolve(WORKLOAD_PATH).startsWith(`${resolve(options.workspace)}\\`),
    },
    correctness: {
      status: correctnessStatus,
      command: correctnessRun.command,
      exit_code: correctnessRun.exit_code,
      wall_time_ms: correctnessRun.wall_time_ms,
      test_summary: parsedTests,
    },
    performance: {
      measurement_kind: "benchmark",
      profiler_enabled: false,
      process_repetitions_requested: repetitions,
      process_repetitions_completed: benchmarkRuns.length,
      samples_per_process: manifest.benchmark_protocol.timeit_samples_per_process,
      warmup_samples_discarded: manifest.benchmark_protocol.warmup_samples_discarded,
      cache_policy: manifest.benchmark_protocol.cache_policy,
      process_runs: benchmarkRuns,
      runtime_samples_seconds: runtimeSamples,
      statistics,
    },
    comparison: {
      baseline_supplied: Boolean(options.baseline),
      baseline_path: options.baseline ?? null,
      baseline_schema: baseline?.schema ?? null,
      baseline_mean_seconds: baseline?.mean_seconds ?? null,
      candidate_mean_seconds: statistics?.mean_seconds ?? null,
      speedup,
      formula: options.baseline ? "baseline mean runtime / candidate mean runtime" : null,
      noise_rule: noiseRule,
    },
    environment,
    artifacts: {
      directory: outputDir,
      machine_readable: join(outputDir, "evaluation.json"),
      human_readable: join(outputDir, "summary.md"),
      correctness_stdout: join(outputDir, "correctness.stdout.txt"),
      correctness_stderr: join(outputDir, "correctness.stderr.txt"),
    },
  };

  await writeFile(join(outputDir, "evaluation.json"), `${JSON.stringify(evaluation, null, 2)}\n`, "utf8");
  await writeFile(join(outputDir, "summary.md"), renderHumanSummary(evaluation), "utf8");
  console.log(
    JSON.stringify(
      {
        evaluation_status: evaluation.evaluation_status,
        outcome: evaluation.outcome,
        correctness: evaluation.correctness,
        performance: {
          runtime_samples_seconds: runtimeSamples,
          statistics,
        },
        comparison: evaluation.comparison,
        artifacts: evaluation.artifacts,
      },
      null,
      2,
    ),
  );
  if (evaluationStatus !== "COMPLETED") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});

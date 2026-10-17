import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

const ROOT = resolve(import.meta.dirname, "..", "..");
const WORKSPACE = join(ROOT, "workspaces", "m2-sympy-20228");
const TASK_DIR = join(ROOT, "experiments", "tasks", "sympy__sympy-20228");
const WORKLOAD = join(TASK_DIR, "evaluator", "workload_windows.py");
const PYTHON = join(WORKSPACE, ".venv", "Scripts", "python.exe");
const EXPECTED_COMMIT = "c237fe7f4c1a4abcfaef0e79600e26cba4ac0a6d";
const RUN_ID = new Date().toISOString().replaceAll(":", "").replaceAll("-", "").replace(".000Z", "Z");
const EVIDENCE_DIR = join(ROOT, "results", "raw", "m2", "sympy__sympy-20228", RUN_ID);
const CORRECTNESS_FILES = [
  "sympy/functions/elementary/tests/test_integers.py",
  "sympy/functions/elementary/tests/test_interface.py",
  "sympy/functions/elementary/tests/test_complexes.py",
  "sympy/functions/elementary/tests/test_miscellaneous.py",
  "sympy/functions/elementary/tests/test_hyperbolic.py",
  "sympy/functions/elementary/tests/test_piecewise.py",
  "sympy/functions/elementary/tests/test_exponential.py",
  "sympy/functions/elementary/tests/test_trigonometric.py",
];

function run(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const started = performance.now();
    const child = spawn(command, args, {
      cwd: options.cwd ?? WORKSPACE,
      env: { ...process.env, ...options.env },
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
        exitCode,
        elapsedMs: Math.round(performance.now() - started),
        stdout,
        stderr,
      });
    });
  });
}

function sampleStdev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const stdev = sampleStdev(values);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return {
    count: values.length,
    meanSeconds: mean,
    medianSeconds: median,
    stdevSeconds: stdev,
    minSeconds: sorted[0],
    maxSeconds: sorted.at(-1),
    coefficientOfVariationPercent: (stdev / mean) * 100,
  };
}

function parseWorkloadOutput(stdout) {
  const lines = stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  return JSON.parse(lines.at(-1));
}

async function main() {
  if (!existsSync(PYTHON)) throw new Error(`Virtual-environment Python not found: ${PYTHON}`);
  if (!existsSync(WORKLOAD)) throw new Error(`Evaluator workload not found: ${WORKLOAD}`);
  await mkdir(EVIDENCE_DIR, { recursive: true });

  const revision = await run("git.exe", ["rev-parse", "HEAD"]);
  if (revision.exitCode !== 0 || revision.stdout.trim() !== EXPECTED_COMMIT) {
    throw new Error(`Unexpected target revision: ${revision.stdout || revision.stderr}`);
  }
  const statusBefore = await run("git.exe", ["status", "--short"]);
  if (statusBefore.exitCode !== 0 || statusBefore.stdout.trim()) {
    throw new Error(`Target workspace is not clean: ${statusBefore.stdout || statusBefore.stderr}`);
  }

  const environment = {
    git: await run("git.exe", ["--version"], { cwd: ROOT }),
    python: await run(PYTHON, ["--version"]),
    pip: await run(PYTHON, ["-m", "pip", "--version"]),
    dependencies: await run(PYTHON, ["-m", "pip", "freeze"]),
    platform: await run(PYTHON, ["-c", "import json,platform; print(json.dumps({'platform': platform.platform(), 'processor': platform.processor(), 'python_implementation': platform.python_implementation()}))"]),
  };

  const correctness = await run(
    PYTHON,
    ["bin/test", "--no-subprocess", "--verbose", "--no-colors", ...CORRECTNESS_FILES],
    { env: { PYTHONWARNINGS: "ignore::UserWarning,ignore::SyntaxWarning" } },
  );
  await writeFile(join(EVIDENCE_DIR, "correctness.stdout.txt"), correctness.stdout, "utf8");
  await writeFile(join(EVIDENCE_DIR, "correctness.stderr.txt"), correctness.stderr, "utf8");

  const benchmarkRuns = [];
  if (correctness.exitCode === 0) {
    for (let index = 1; index <= 3; index += 1) {
      const result = await run(PYTHON, [WORKLOAD]);
      await writeFile(join(EVIDENCE_DIR, `benchmark-${index}.stdout.txt`), result.stdout, "utf8");
      await writeFile(join(EVIDENCE_DIR, `benchmark-${index}.stderr.txt`), result.stderr, "utf8");
      benchmarkRuns.push({ index, ...result, parsed: result.exitCode === 0 ? parseWorkloadOutput(result.stdout) : undefined });
      if (result.exitCode !== 0) break;
    }
  }

  const samples = benchmarkRuns.flatMap((runResult) => runResult.parsed?.runtimes_seconds ?? []);
  const processMeans = benchmarkRuns.flatMap((runResult) =>
    runResult.parsed ? [runResult.parsed.mean_seconds] : [],
  );
  const statusAfter = await run("git.exe", ["status", "--short"]);
  const summary = {
    schemaVersion: 1,
    runId: RUN_ID,
    status:
      correctness.exitCode === 0 && benchmarkRuns.length === 3 && benchmarkRuns.every((item) => item.exitCode === 0)
        ? "PASS"
        : "FAIL",
    task: {
      instanceId: "sympy__sympy-20228",
      repository: "sympy/sympy",
      revision: revision.stdout.trim(),
      workspace: WORKSPACE,
    },
    protocol: {
      nativeWindows: process.platform === "win32",
      profilerEnabled: false,
      correctnessFiles: CORRECTNESS_FILES,
      benchmarkProcessRepetitions: 3,
      timeitSamplesPerProcess: 10,
      warmupSamplesDiscarded: 0,
      cachePolicy: "clear_cache before every timed sample",
      processAffinity: "not pinned",
      processPriority: "default",
    },
    environment,
    correctness: {
      command: correctness.command,
      exitCode: correctness.exitCode,
      elapsedMs: correctness.elapsedMs,
    },
    benchmark: {
      successfulProcesses: benchmarkRuns.filter((item) => item.exitCode === 0).length,
      processRuns: benchmarkRuns.map((item) => ({
        index: item.index,
        exitCode: item.exitCode,
        wallElapsedMs: item.elapsedMs,
        runtimesSeconds: item.parsed?.runtimes_seconds,
        reportedMeanSeconds: item.parsed?.mean_seconds,
        reportedStdevSeconds: item.parsed?.stdev_seconds,
      })),
      allSamplesSeconds: samples,
      allSamplesSummary: samples.length ? summarize(samples) : undefined,
      processMeansSummary: processMeans.length ? summarize(processMeans) : undefined,
    },
    repositoryCleanAfterRun: statusAfter.exitCode === 0 && !statusAfter.stdout.trim(),
  };

  await writeFile(join(EVIDENCE_DIR, "environment.json"), `${JSON.stringify(environment, null, 2)}\n`, "utf8");
  await writeFile(join(EVIDENCE_DIR, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ...summary, environment: undefined, evidenceDir: EVIDENCE_DIR }, null, 2));
  if (summary.status !== "PASS") process.exitCode = 1;
}

main().catch(async (error) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  const failure = {
    schemaVersion: 1,
    runId: RUN_ID,
    status: "FAIL",
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
  };
  await writeFile(join(EVIDENCE_DIR, "summary.json"), `${JSON.stringify(failure, null, 2)}\n`, "utf8");
  console.error(JSON.stringify({ ...failure, evidenceDir: EVIDENCE_DIR }, null, 2));
  process.exitCode = 1;
});

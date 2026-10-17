import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..", "..");
const REVISION = "8ddf9c29e345df987e82f8c5905dd0b32ea0a4b6";

function parseArguments(argv) {
  const options = { samples: 5 };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!value || !["--workspace", "--output", "--baseline", "--samples"].includes(key)) throw new Error(`Unknown or incomplete argument: ${key}`);
    options[{ "--workspace": "workspace", "--output": "output", "--baseline": "baseline", "--samples": "samples" }[key]] = key === "--samples" ? Number(value) : resolve(value);
  }
  if (!options.workspace || !options.output) throw new Error("--workspace and --output are required");
  if (![3, 4, 5].includes(options.samples)) throw new Error("--samples must be 3, 4, or 5");
  return options;
}

function run(command, args, cwd) {
  return new Promise((resolvePromise, rejectPromise) => {
    const started = performance.now();
    const child = spawn(command, args, { cwd, shell: false, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.once("error", rejectPromise);
    child.once("close", (exitCode) => resolvePromise({ exitCode, elapsedMs: Math.round(performance.now() - started), stdout, stderr }));
  });
}

const options = parseArguments(process.argv.slice(2));
const python = join(options.workspace, ".venv", "Scripts", "python.exe");
const revision = await run("git.exe", ["rev-parse", "HEAD"], options.workspace);
if (revision.exitCode !== 0 || revision.stdout.trim() !== REVISION) throw new Error("Unexpected workspace revision");

await mkdir(options.output, { recursive: true });
const correctness = await run(python, ["bin/test", "--no-subprocess", "--verbose", "--no-colors", "sympy/polys/domains/tests/test_domains.py"], options.workspace);
await writeFile(join(options.output, "correctness.stdout.txt"), correctness.stdout, "utf8");
await writeFile(join(options.output, "correctness.stderr.txt"), correctness.stderr, "utf8");

let benchmark = null;
if (correctness.exitCode === 0) {
  const measured = await run(python, [join(ROOT, "scripts", "evaluation", "run_sympy_21391_sanity.py"), "--samples", String(options.samples)], options.workspace);
  if (measured.exitCode !== 0) throw new Error(`Sanity benchmark failed: ${measured.stderr}`);
  benchmark = { ...JSON.parse(measured.stdout.trim().split(/\r?\n/u).at(-1)), process_wall_time_ms: measured.elapsedMs };
}

let comparison = null;
if (benchmark && options.baseline) {
  const baseline = JSON.parse(await readFile(options.baseline, "utf8"));
  comparison = { baseline_mean_seconds: baseline.mean_seconds, candidate_mean_seconds: benchmark.mean_seconds, speedup: baseline.mean_seconds / benchmark.mean_seconds };
}
const result = {
  schema_version: 1,
  purpose: "development sanity check only; not an M3 or formal performance result",
  correctness: { status: correctness.exitCode === 0 ? "PASS" : "FAIL", exit_code: correctness.exitCode, wall_time_ms: correctness.elapsedMs },
  benchmark,
  comparison,
  outcome: correctness.exitCode !== 0 ? "SANITY_REGRESSION" : "SANITY_COMPLETED",
};
await writeFile(join(options.output, "evaluation.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));

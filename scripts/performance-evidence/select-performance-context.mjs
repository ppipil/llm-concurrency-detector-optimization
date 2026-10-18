import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import process from "node:process";

import { extractTaskFocus, selectPerformanceContext, SELECTOR_VERSION } from "./performance-context-selector.mjs";

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--") || index + 1 >= argv.length) throw new Error(`Invalid argument: ${key}`);
    values[key.slice(2)] = argv[index + 1];
    index += 1;
  }
  for (const required of ["profile", "task", "workspace", "output", "task-id", "base-commit", "char-budget"]) {
    if (!values[required]) throw new Error(`Missing --${required}`);
  }
  return values;
}

function run(command, args, cwd) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd, windowsHide: true, shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", rejectPromise);
    child.once("close", (exitCode) => resolvePromise({ exitCode, stdout, stderr }));
  });
}

async function walkFiles(root) {
  const result = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) result.push(path);
    }
  }
  await visit(root);
  return result;
}

async function directoryExists(path) {
  try {
    return (await readdir(path, { withFileTypes: true })) !== undefined;
  } catch {
    return false;
  }
}

async function loadRepositorySources(workspace, profileDocument) {
  const paths = [...new Set(profileDocument.profile.functions
    .filter((item) => item.repository_owned && !item.source_file.startsWith("<"))
    .map((item) => item.source_file))];
  const sources = {};
  for (const path of paths) {
    const absolute = resolve(workspace, path);
    if (!absolute.startsWith(`${workspace}\\`) && absolute !== workspace) continue;
    try { sources[path] = await readFile(absolute, "utf8"); } catch {}
  }
  return sources;
}

async function loadTests(workspace) {
  const testRoots = [];
  const topLevelTests = join(workspace, "tests");
  if (await directoryExists(topLevelTests)) testRoots.push(topLevelTests);
  for (const entry of await readdir(workspace, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const nestedTests = join(workspace, entry.name, "tests");
    if (await directoryExists(nestedTests)) testRoots.push(nestedTests);
  }
  const tests = {};
  for (const testRoot of [...new Set(testRoots)].sort()) {
    for (const path of await walkFiles(testRoot)) {
      if (![".py", ".js", ".ts"].includes(extname(path).toLowerCase())) continue;
      tests[relative(workspace, path).replaceAll("\\", "/")] = await readFile(path, "utf8");
    }
  }
  return tests;
}

async function main() {
  if (process.platform !== "win32") throw new Error("Native Windows only");
  const args = parseArgs(process.argv.slice(2));
  const workspace = resolve(args.workspace);
  const output = resolve(args.output);
  const profilePath = resolve(args.profile);
  const profileRaw = await readFile(profilePath, "utf8");
  const profileDocument = JSON.parse(profileRaw);
  if (profileDocument.evidence_type !== "runtime_profile" || profileDocument.profiler_run?.status !== "PASS") {
    throw new Error("Selector requires successful raw runtime profile evidence");
  }
  if (profileDocument.task?.instance_id !== args["task-id"] || profileDocument.task?.revision !== args["base-commit"]) {
    throw new Error("Profiler evidence task/revision mismatch");
  }
  const revision = (await run("git.exe", ["rev-parse", "HEAD"], workspace)).stdout.trim();
  const status = await run("git.exe", ["status", "--porcelain"], workspace);
  if (revision !== args["base-commit"] || status.exitCode !== 0 || status.stdout.trim()) {
    throw new Error("Selector workspace must be clean at the fixed base commit");
  }
  const taskDescription = await readFile(resolve(args.task), "utf8");
  const taskFocus = extractTaskFocus(taskDescription);
  const sourceFiles = await loadRepositorySources(workspace, profileDocument);
  const testFiles = await loadTests(workspace);
  const result = selectPerformanceContext({
    profileDocument,
    taskDescription,
    sourceFiles,
    testFiles,
    charBudget: Number.parseInt(args["char-budget"], 10),
  });
  const audit = {
    schema_version: 1,
    selector_version: SELECTOR_VERSION,
    created_at: new Date().toISOString(),
    inputs: {
      task_id: args["task-id"],
      base_commit: args["base-commit"],
      profile_sha256: createHash("sha256").update(profileRaw).digest("hex"),
      task_sha256: createHash("sha256").update(taskDescription).digest("hex"),
      task_focus: taskFocus,
      task_focus_sha256: createHash("sha256").update(taskFocus).digest("hex"),
      source_file_count: Object.keys(sourceFiles).length,
      test_file_count: Object.keys(testFiles).length,
      forbidden_post_edit_inputs_used: false,
    },
    ...result,
  };
  await mkdir(dirname(output), { recursive: true });
  await mkdir(output, { recursive: false });
  await writeFile(join(output, "performance-context.txt"), `${result.context}\n`, "utf8");
  await writeFile(join(output, "selector-audit.json"), `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  const selected = result.ranking.filter((item) => result.selected_target_ids.includes(item.id));
  const summary = `# Performance-Aware Context Selection\n\n- Selector: \`${SELECTOR_VERSION}\`\n- Task: \`${args["task-id"]}\`\n- Base commit: \`${args["base-commit"]}\`\n- Budget: ${result.budget.characters_used}/${result.budget.character_limit} characters (~${result.budget.estimated_tokens_at_four_chars_per_token} tokens)\n- Selected targets: ${selected.length}\n\n${selected.map((item) => `## Rank ${item.rank}: \`${item.function}\`\n\n- Location: \`${item.source_file}:${item.source_line}\`\n- Score: ${item.score}\n- Reasons: ${item.reasons.join("; ")}\n- Related tests: ${item.related_tests.join(", ") || "none"}\n`).join("\n")}\n`;
  await writeFile(join(output, "summary.md"), summary, "utf8");
  console.log(JSON.stringify({ output, budget: result.budget, selected: selected.map((item) => ({ rank: item.rank, id: item.id, score: item.score })) }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});

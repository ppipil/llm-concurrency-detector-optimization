import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";

import {
  createAgentSession,
  createExtensionRuntime,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

const PROVIDER = "cslab";
const BASE_URL = "https://llm.cs.cityu.edu.hk/v1";
const MODEL_ID = "CS/DeepSeek-V4-Flash-FP8";
const REQUIRED_TOOLS = ["read", "grep", "edit", "write", "bash"];
const ROOT = resolve(import.meta.dirname, "..", "..");
const SMOKE_REPO = join(ROOT, "workspaces", "m1-smoke");
const RUN_ID = new Date().toISOString().replaceAll(":", "").replaceAll("-", "").replace(".000Z", "Z");
const EVIDENCE_DIR = join(ROOT, "results", "raw", "m1d", RUN_ID);
const EVENTS_PATH = join(EVIDENCE_DIR, "events.jsonl");
const SUMMARY_PATH = join(EVIDENCE_DIR, "summary.json");
const TIMEOUT_MS = 5 * 60 * 1000;
const CMD = process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe";

function run(command, args, cwd) {
  return new Promise((resolvePromise, rejectPromise) => {
    const started = performance.now();
    const child = spawn(command, args, { cwd, shell: false, windowsHide: true });
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

async function findGitBash() {
  const explicit = process.env.PI_BASH_PATH;
  if (explicit && existsSync(explicit)) return explicit;

  const whereBash = await run("where.exe", ["bash.exe"], ROOT);
  if (whereBash.exitCode === 0) {
    const candidate = whereBash.stdout.split(/\r?\n/u).find((line) => line.trim());
    if (candidate && existsSync(candidate.trim())) return candidate.trim();
  }

  const whereGit = await run("where.exe", ["git.exe"], ROOT);
  if (whereGit.exitCode === 0) {
    for (const line of whereGit.stdout.split(/\r?\n/u)) {
      if (!line.trim()) continue;
      const candidate = resolve(dirname(line.trim()), "..", "bin", "bash.exe");
      if (existsSync(candidate)) return candidate;
    }
  }

  throw new Error("Git Bash was not found. Set PI_BASH_PATH to its bash.exe path.");
}

function compactToolResult(result) {
  const text = Array.isArray(result?.content)
    ? result.content
        .filter((item) => item?.type === "text")
        .map((item) => item.text)
        .join("\n")
    : "";
  return {
    isError: result?.isError === true,
    text: text.slice(0, 2000),
  };
}

function createResourceLoader() {
  const runtime = createExtensionRuntime();
  return {
    getExtensions: () => ({ extensions: [], errors: [], runtime }),
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => `You are a coding agent operating in a tiny isolated repository.
Use the provided tools to complete the requested task. Inspect files before editing.
Use grep to locate relevant symbols, make the smallest source-only change, and run the real test command.
Do not modify tests. Do not only describe a solution: perform the tool calls and verify the result.`,
    getSystemPromptSource: () => undefined,
    getAppendSystemPrompt: () => [],
    getAppendSystemPromptSources: () => [],
    extendResources: () => {},
    reload: async () => {},
  };
}

async function main() {
  const apiKey = process.env.CSLAB_API_KEY;
  if (!apiKey) throw new Error("CSLAB_API_KEY is missing from the current process.");
  if (!existsSync(SMOKE_REPO)) throw new Error(`Smoke repository not found: ${SMOKE_REPO}`);

  await mkdir(EVIDENCE_DIR, { recursive: true });

  const repositoryRevision = (await run("git.exe", ["rev-parse", "HEAD"], SMOKE_REPO)).stdout.trim();
  const initialStatus = await run("git.exe", ["status", "--short"], SMOKE_REPO);
  if (initialStatus.exitCode !== 0 || initialStatus.stdout.trim()) {
    throw new Error(`Smoke repository must start clean. Status: ${initialStatus.stdout || initialStatus.stderr}`);
  }

  const baseline = await run(CMD, ["/d", "/s", "/c", "npm.cmd test"], SMOKE_REPO);
  if (baseline.exitCode === 0) throw new Error("Smoke baseline unexpectedly passed; expected the committed failing fixture.");

  const gitBash = await findGitBash();
  const modelRuntime = await ModelRuntime.create({ modelsPath: null, refreshOnCreate: false });
  modelRuntime.registerProvider(PROVIDER, {
    name: "CSLab",
    baseUrl: BASE_URL,
    api: "openai-completions",
    models: [
      {
        id: MODEL_ID,
        name: "CSLab DeepSeek V4 Flash FP8",
        api: "openai-completions",
        baseUrl: BASE_URL,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        reasoning: false,
        contextWindow: 128000,
        maxTokens: 16384,
      },
    ],
  });
  await modelRuntime.setRuntimeApiKey(PROVIDER, apiKey);

  const model = modelRuntime.getModel(PROVIDER, MODEL_ID);
  if (!model) throw new Error(`Pi did not register ${PROVIDER}/${MODEL_ID}.`);

  const settingsManager = SettingsManager.inMemory({
    compaction: { enabled: false },
    retry: { enabled: false },
    shellPath: gitBash,
  });
  const { session } = await createAgentSession({
    cwd: SMOKE_REPO,
    model,
    thinkingLevel: "off",
    modelRuntime,
    resourceLoader: createResourceLoader(),
    tools: REQUIRED_TOOLS,
    sessionManager: SessionManager.inMemory(SMOKE_REPO),
    settingsManager,
  });

  const events = [];
  const toolSequence = [];
  const startedAt = new Date();
  const started = performance.now();
  const unsubscribe = session.subscribe((event) => {
    const base = { atMs: Math.round(performance.now() - started), type: event.type };
    if (event.type === "tool_execution_start") {
      toolSequence.push(event.toolName);
      events.push({ ...base, toolCallId: event.toolCallId, toolName: event.toolName, args: event.args });
    } else if (event.type === "tool_execution_end") {
      events.push({
        ...base,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        isError: event.isError,
        result: compactToolResult(event.result),
      });
    } else if (event.type === "message_end" && event.message?.role === "assistant") {
      events.push({
        ...base,
        role: "assistant",
        stopReason: event.message.stopReason,
        usage: event.message.usage,
        errorMessage: event.message.errorMessage,
      });
    } else if (["agent_start", "turn_start", "turn_end", "agent_end", "agent_settled"].includes(event.type)) {
      events.push(base);
    }
  });

  let promptError;
  const timeout = setTimeout(() => {
    void session.abort();
  }, TIMEOUT_MS);
  try {
    await session.prompt(
      "Read TASK.md and complete it now. You must use the grep tool to locate greet, read the relevant file, edit or write the source fix, and use the bash tool to run npm test. Stop only after reporting the real test result.",
    );
  } catch (error) {
    promptError = error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) };
  } finally {
    clearTimeout(timeout);
  }

  const elapsedMs = Math.round(performance.now() - started);
  const sessionStats = session.getSessionStats();
  unsubscribe();
  session.dispose();

  const finalStatus = await run("git.exe", ["status", "--short"], SMOKE_REPO);
  const sourceDiff = await run("git.exe", ["diff", "--", "src/greeting.js"], SMOKE_REPO);
  const testDiff = await run("git.exe", ["diff", "--", "test/greeting.test.js"], SMOKE_REPO);
  const independentTest = await run(CMD, ["/d", "/s", "/c", "npm.cmd test"], SMOKE_REPO);
  const finalSource = await readFile(join(SMOKE_REPO, "src", "greeting.js"), "utf8");

  const requiredObserved = {
    read: toolSequence.includes("read"),
    search: toolSequence.includes("grep"),
    editOrWrite: toolSequence.includes("edit") || toolSequence.includes("write"),
    bash: toolSequence.includes("bash"),
  };
  const passed =
    !promptError &&
    requiredObserved.read &&
    requiredObserved.editOrWrite &&
    requiredObserved.bash &&
    independentTest.exitCode === 0 &&
    testDiff.stdout.length === 0 &&
    sourceDiff.stdout.length > 0;

  const summary = {
    schemaVersion: 1,
    runId: RUN_ID,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    elapsedMs,
    status: passed ? "PASS" : "PARTIAL",
    environment: {
      platform: process.platform,
      node: process.version,
      piPackage: "@earendil-works/pi-coding-agent@1.0.3",
      apiKeySource: "process.env.CSLAB_API_KEY",
      apiKeyRecorded: false,
      gitBash,
    },
    provider: { id: PROVIDER, baseUrl: BASE_URL, api: "openai-completions", model: MODEL_ID },
    repository: { path: SMOKE_REPO, revision: repositoryRevision, initialClean: true },
    baseline: { exitCode: baseline.exitCode, elapsedMs: baseline.elapsedMs, stdout: baseline.stdout, stderr: baseline.stderr },
    agent: {
      promptError,
      activeTools: REQUIRED_TOOLS,
      toolSequence,
      requiredObserved,
      stats: sessionStats,
    },
    verification: {
      finalStatus: finalStatus.stdout,
      sourceDiff: sourceDiff.stdout,
      testDiff: testDiff.stdout,
      finalSource,
      independentTest,
    },
  };

  await writeFile(EVENTS_PATH, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");
  await writeFile(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ...summary, baseline: { ...summary.baseline, stdout: undefined, stderr: undefined }, verification: { ...summary.verification, independentTest: { ...independentTest, stdout: undefined, stderr: undefined } }, evidenceDir: EVIDENCE_DIR }, null, 2));
  if (!passed) process.exitCode = 1;
}

main().catch(async (error) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  const failure = {
    schemaVersion: 1,
    runId: RUN_ID,
    status: "FAIL",
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
    apiKeyRecorded: false,
  };
  await writeFile(SUMMARY_PATH, `${JSON.stringify(failure, null, 2)}\n`, "utf8");
  console.error(JSON.stringify({ ...failure, evidenceDir: EVIDENCE_DIR }, null, 2));
  process.exitCode = 1;
});

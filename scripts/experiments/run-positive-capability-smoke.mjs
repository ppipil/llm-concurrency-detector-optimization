import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import process from "node:process";

import {
  createAgentSession,
  createExtensionRuntime,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

import {
  CALIBRATION_PROTOCOL_VERSION,
  CALIBRATION_RESOURCE_CONTROL,
  createCalibrationBashToolDefinition,
} from "../research-controller/calibration-policy.mjs";
import { createContextCapacitySnapshot } from "../research-controller/context-capacity.mjs";
import { createExecutionLifecycle } from "../research-controller/execution-lifecycle.mjs";
import { buildAgentPrompt, buildAgentSystemPrompt } from "../research-controller/prompt-builder.mjs";
import { classifyTermination } from "../research-controller/termination.mjs";
import { createUsageTelemetry } from "../research-controller/usage-telemetry.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");
const WORKSPACE = join(ROOT, "workspaces", "m5j-positive-capability");
const TASK_PATH = join(ROOT, "experiments", "tasks", "capability-smoke-unique-in-order", "agent", "task.md");
const EVIDENCE_DIR = join(ROOT, "results", "raw", "m5j", "positive-capability-smoke", "B0");
const PROVIDER = "cslab";
const BASE_URL = "https://llm.cs.cityu.edu.hk/v1";
const MODEL_ID = "CS/DeepSeek-V4-Flash-FP8";
const TOOLS = ["read", "grep", "edit", "write", "bash"];

function run(command, args, cwd) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd, shell: false, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.once("error", rejectPromise);
    child.once("close", (exitCode) => resolvePromise({ exitCode, stdout, stderr }));
  });
}

async function findGitBash() {
  const explicit = process.env.PI_BASH_PATH;
  if (explicit && existsSync(explicit)) return explicit;
  const located = await run("where.exe", ["git.exe"], ROOT);
  for (const line of located.stdout.split(/\r?\n/u)) {
    if (!line.trim()) continue;
    const candidate = resolve(dirname(line.trim()), "..", "bin", "bash.exe");
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("Git Bash was not found");
}

function createResourceLoader(systemPrompt) {
  const runtime = createExtensionRuntime();
  return {
    getExtensions: () => ({ extensions: [], errors: [], runtime }),
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => systemPrompt,
    getSystemPromptSource: () => undefined,
    getAppendSystemPrompt: () => [],
    getAppendSystemPromptSources: () => [],
    extendResources: () => {},
    reload: async () => {},
  };
}

function textOf(message) {
  if (typeof message?.content === "string") return message.content;
  if (!Array.isArray(message?.content)) return "";
  return message.content.filter((item) => item?.type === "text").map((item) => item.text).join("\n");
}

async function main() {
  if (process.platform !== "win32") throw new Error("Native Windows only");
  const apiKey = process.env.CSLAB_API_KEY;
  if (!apiKey) throw new Error("CSLAB_API_KEY is missing from the current process");

  const revision = (await run("git.exe", ["rev-parse", "HEAD"], WORKSPACE)).stdout.trim();
  const initialStatus = (await run("git.exe", ["status", "--porcelain"], WORKSPACE)).stdout.trim();
  if (initialStatus) throw new Error(`Capability workspace must start clean:\n${initialStatus}`);
  await mkdir(EVIDENCE_DIR, { recursive: true });

  const taskDescription = await readFile(TASK_PATH, "utf8");
  const prompt = buildAgentPrompt({
    taskDescription,
    performanceContext: "",
    resourceControl: CALIBRATION_RESOURCE_CONTROL,
    runClassification: "positive capability calibration only, not a formal experiment",
  });
  const systemPrompt = buildAgentSystemPrompt();
  await writeFile(join(EVIDENCE_DIR, "prompt.md"), prompt, "utf8");
  await writeFile(join(EVIDENCE_DIR, "system-prompt.md"), systemPrompt, "utf8");

  const gitBash = await findGitBash();
  const modelRuntime = await ModelRuntime.create({ modelsPath: null, refreshOnCreate: false });
  modelRuntime.registerProvider(PROVIDER, {
    name: "CSLab",
    baseUrl: BASE_URL,
    api: "openai-completions",
    models: [{
      id: MODEL_ID,
      name: "CSLab DeepSeek V4 Flash FP8",
      api: "openai-completions",
      baseUrl: BASE_URL,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      reasoning: false,
      contextWindow: 128000,
      maxTokens: CALIBRATION_RESOURCE_CONTROL.modelResponse.maxOutputTokensPerResponse,
    }],
  });
  await modelRuntime.setRuntimeApiKey(PROVIDER, apiKey);
  const model = modelRuntime.getModel(PROVIDER, MODEL_ID);
  const settingsManager = SettingsManager.inMemory({
    compaction: { enabled: false },
    retry: { enabled: false },
    shellPath: gitBash,
  });
  const bashTool = createCalibrationBashToolDefinition(WORKSPACE, { shellPath: gitBash });
  const { session } = await createAgentSession({
    cwd: WORKSPACE,
    model,
    thinkingLevel: "off",
    modelRuntime,
    resourceLoader: createResourceLoader(systemPrompt),
    tools: TOOLS,
    customTools: [bashTool],
    sessionManager: SessionManager.inMemory(WORKSPACE),
    settingsManager,
  });

  const events = [];
  const usageTelemetry = createUsageTelemetry();
  const startedAt = new Date();
  const started = performance.now();
  const lifecycle = createExecutionLifecycle({
    executionBudget: CALIBRATION_RESOURCE_CONTROL.execution,
    emergencyProviderUsageCap: null,
    usageTelemetry,
    abortRun: () => session.abort(),
  });
  lifecycle.install(session.agent);
  const unsubscribe = session.subscribe((event) => {
    const record = { atMs: Math.round(performance.now() - started), type: event.type };
    if (event.type === "message_end") {
      events.push({ ...record, role: event.message?.role, stopReason: event.message?.stopReason, usage: event.message?.usage, text: textOf(event.message) });
    } else if (event.type === "tool_execution_start") {
      events.push({ ...record, toolCallId: event.toolCallId, toolName: event.toolName, args: event.args });
    } else if (event.type === "tool_execution_end") {
      events.push({ ...record, toolCallId: event.toolCallId, toolName: event.toolName, isError: event.isError, text: textOf(event.result) });
    } else if (["agent_start", "turn_start", "turn_end", "agent_end", "agent_settled"].includes(event.type)) {
      events.push(record);
    }
  });

  const timer = lifecycle.startWallClockTimer();
  let promptError;
  try {
    await session.prompt(prompt);
  } catch (error) {
    promptError = error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) };
  } finally {
    clearTimeout(timer);
  }

  const elapsedMs = Math.round(performance.now() - started);
  const lifecycleState = lifecycle.state;
  const usage = usageTelemetry.snapshot();
  const context = createContextCapacitySnapshot({
    contextUsage: session.getContextUsage(),
    contextWindow: model.contextWindow,
    reserveTokens: CALIBRATION_RESOURCE_CONTROL.context.reserveTokens,
  });
  const transcript = session.messages;
  const terminalAssistant = transcript.filter((message) => message.role === "assistant").at(-1) ?? null;
  const terminationReason = classifyTermination(lifecycleState, terminalAssistant);
  unsubscribe();
  session.dispose();

  const status = await run("git.exe", ["status", "--short"], WORKSPACE);
  const changedFilesResult = await run("git.exe", ["diff", "--name-only", "HEAD", "--"], WORKSPACE);
  const patch = await run("git.exe", ["diff", "--binary", "HEAD", "--"], WORKSPACE);
  const changedFiles = changedFilesResult.stdout.split(/\r?\n/u).filter(Boolean);
  const patchPresent = changedFiles.includes("sequence_ops.py");
  const testPattern = /(?:\bunittest\b|\bpytest\b)/iu;
  const agentDrivenTests = events.filter((event) => event.type === "tool_execution_start" && event.toolName === "bash" && testPattern.test(event.args?.command ?? ""));

  const summary = {
    schemaVersion: 1,
    classification: "positive capability calibration; excluded from formal experiment data",
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    elapsedMs,
    promptError,
    protocol: CALIBRATION_PROTOCOL_VERSION,
    resourceControl: CALIBRATION_RESOURCE_CONTROL,
    repository: { workspace: WORKSPACE, revision, finalStatus: status.stdout, changedFiles },
    agent: { provider: PROVIDER, baseUrl: BASE_URL, model: MODEL_ID, tools: TOOLS, agentDrivenTests },
    execution: lifecycleState,
    usage,
    context,
    terminationReason,
    patchPresent,
  };
  await writeFile(join(EVIDENCE_DIR, "events.jsonl"), `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");
  await writeFile(join(EVIDENCE_DIR, "transcript.json"), `${JSON.stringify(transcript, null, 2)}\n`, "utf8");
  await writeFile(join(EVIDENCE_DIR, "patch.diff"), patch.stdout, "utf8");
  await writeFile(join(EVIDENCE_DIR, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
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
import {
  buildAgentPrompt,
  buildAgentSystemPrompt,
  renderMechanicalProfilerEvidence,
} from "../research-controller/prompt-builder.mjs";
import { classifyTermination } from "../research-controller/termination.mjs";
import { createUsageTelemetry } from "../research-controller/usage-telemetry.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");
const WORKSPACE = process.env.M5K_WORKSPACE
  ? resolve(process.env.M5K_WORKSPACE)
  : join(ROOT, "workspaces", "m5k-optuna-3672");
const TASK_PATH = process.env.M5K_TASK_PATH
  ? resolve(process.env.M5K_TASK_PATH)
  : join(ROOT, "experiments", "tasks", "formulacode-optuna-3672", "agent", "task.md");
const TASK_ID = process.env.M5K_TASK_ID ?? "optuna_optuna_3672";
const GROUP = process.env.M5K_GROUP ?? "B0";
const EVIDENCE_DIR = process.env.M5K_EVIDENCE_DIR
  ? resolve(process.env.M5K_EVIDENCE_DIR)
  : join(ROOT, "results", "raw", "m5k", TASK_ID, GROUP);
const PROFILE_EVIDENCE_PATH = process.env.M5K_PROFILE_EVIDENCE
  ? resolve(process.env.M5K_PROFILE_EVIDENCE)
  : null;
const SELECTED_CONTEXT_PATH = process.env.M5K_SELECTED_CONTEXT
  ? resolve(process.env.M5K_SELECTED_CONTEXT)
  : null;
const SELECTOR_AUDIT_PATH = process.env.M5K_SELECTOR_AUDIT
  ? resolve(process.env.M5K_SELECTOR_AUDIT)
  : null;
const EXPECTED_REVISION = process.env.M5K_BASE_COMMIT ?? null;
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
  if (!["B0", "B1", "B2"].includes(GROUP)) throw new Error(`Unsupported calibration group: ${GROUP}`);
  const apiKey = process.env.CSLAB_API_KEY;
  if (!apiKey) throw new Error("CSLAB_API_KEY is missing from the current process");

  const revision = (await run("git.exe", ["rev-parse", "HEAD"], WORKSPACE)).stdout.trim();
  if (EXPECTED_REVISION && revision !== EXPECTED_REVISION) {
    throw new Error(`Unexpected calibration revision: ${revision}`);
  }
  const initialStatus = (await run("git.exe", ["status", "--porcelain"], WORKSPACE)).stdout.trim();
  if (initialStatus) throw new Error(`Calibration workspace must start clean:\n${initialStatus}`);
  await mkdir(EVIDENCE_DIR, { recursive: true });

  const taskDescription = await readFile(TASK_PATH, "utf8");
  let performanceContext = "";
  let performanceEvidence = null;
  if (GROUP === "B1") {
    if (!PROFILE_EVIDENCE_PATH) throw new Error("M5K_PROFILE_EVIDENCE is required for B1");
    const normalizedPath = PROFILE_EVIDENCE_PATH.replaceAll("\\", "/").toLowerCase();
    if (!normalizedPath.includes("/results/raw/profiles/")) {
      throw new Error("B1 evidence must come from the pre-Agent profiling output tree");
    }
    const rawEvidence = await readFile(PROFILE_EVIDENCE_PATH, "utf8");
    const profileDocument = JSON.parse(rawEvidence);
    if (profileDocument.evidence_type !== "runtime_profile") {
      throw new Error("B1 evidence is not runtime profiler evidence");
    }
    if (profileDocument.task?.instance_id !== TASK_ID || profileDocument.task?.revision !== revision) {
      throw new Error("B1 evidence task or revision does not match the calibration checkout");
    }
    if (profileDocument.profiler_run?.status !== "PASS" || profileDocument.profiler_run?.benchmark_eligible !== false) {
      throw new Error("B1 evidence must be a successful profiling-only measurement");
    }
    performanceContext = renderMechanicalProfilerEvidence(profileDocument);
    performanceEvidence = {
      source: PROFILE_EVIDENCE_PATH,
      sha256: createHash("sha256").update(rawEvidence).digest("hex"),
      runId: profileDocument.run_id,
      profiler: profileDocument.profiler?.name,
      topK: 8,
      generatedBeforeAgent: true,
    };
  } else if (GROUP === "B2") {
    if (!SELECTED_CONTEXT_PATH || !SELECTOR_AUDIT_PATH) {
      throw new Error("M5K_SELECTED_CONTEXT and M5K_SELECTOR_AUDIT are required for B2");
    }
    const normalizedContextPath = SELECTED_CONTEXT_PATH.replaceAll("\\", "/").toLowerCase();
    const normalizedAuditPath = SELECTOR_AUDIT_PATH.replaceAll("\\", "/").toLowerCase();
    if (!normalizedContextPath.includes("/results/raw/context-selector/") || !normalizedAuditPath.includes("/results/raw/context-selector/")) {
      throw new Error("B2 inputs must come from the pre-Agent context-selector output tree");
    }
    performanceContext = (await readFile(SELECTED_CONTEXT_PATH, "utf8")).trim();
    const auditRaw = await readFile(SELECTOR_AUDIT_PATH, "utf8");
    const audit = JSON.parse(auditRaw);
    if (audit.inputs?.task_id !== TASK_ID || audit.inputs?.base_commit !== revision) {
      throw new Error("B2 selector audit task or revision does not match the calibration checkout");
    }
    if (audit.inputs?.forbidden_post_edit_inputs_used !== false || audit.context !== performanceContext) {
      throw new Error("B2 selector audit failed isolation or context-integrity validation");
    }
    performanceEvidence = {
      source: SELECTED_CONTEXT_PATH,
      sha256: createHash("sha256").update(`${performanceContext}\n`).digest("hex"),
      selectorAudit: SELECTOR_AUDIT_PATH,
      selectorAuditSha256: createHash("sha256").update(auditRaw).digest("hex"),
      selectorVersion: audit.selector_version,
      selectedTargetIds: audit.selected_target_ids,
      budget: audit.budget,
      generatedBeforeAgent: true,
    };
  }
  const prompt = buildAgentPrompt({
    taskDescription,
    performanceContext,
    resourceControl: CALIBRATION_RESOURCE_CONTROL,
    runClassification: "FormulaCode easy real-repository capability calibration only, not formal experiment data",
  });
  const systemPrompt = buildAgentSystemPrompt();
  await writeFile(join(EVIDENCE_DIR, "prompt.md"), prompt, "utf8");
  await writeFile(join(EVIDENCE_DIR, "system-prompt.md"), systemPrompt, "utf8");
  await writeFile(join(EVIDENCE_DIR, "performance-context.txt"), `${performanceContext}\n`, "utf8");

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
  const patchPresent = changedFiles.length > 0;
  const testPattern = /(?:\bpytest\b|\basv\s+run\b)/iu;
  const agentDrivenTests = events.filter((event) => event.type === "tool_execution_start" && event.toolName === "bash" && testPattern.test(event.args?.command ?? ""));

  const summary = {
    schemaVersion: 1,
    classification: "FormulaCode easy real-repository capability calibration; excluded from formal experiment data",
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    elapsedMs,
    promptError,
    protocol: CALIBRATION_PROTOCOL_VERSION,
    resourceControl: CALIBRATION_RESOURCE_CONTROL,
    repository: { taskId: TASK_ID, workspace: WORKSPACE, revision, finalStatus: status.stdout, changedFiles },
    agent: { group: GROUP, provider: PROVIDER, baseUrl: BASE_URL, model: MODEL_ID, tools: TOOLS, performanceEvidence, agentDrivenTests },
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

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
  AGENT_RESOURCE_CONTROL,
  AGENT_EXECUTION_PROTOCOL_VERSION,
  createPolicyBashToolDefinition,
} from "../research-controller/execution-policy.mjs";
import {
  FAST_SANITY_RESOURCE_CONTROL,
  FAST_SANITY_PROTOCOL_VERSION,
  createFastSanityBashToolDefinition,
} from "../research-controller/fast-sanity-policy.mjs";
import {
  CALIBRATION_RESOURCE_CONTROL,
  CALIBRATION_PROTOCOL_VERSION,
  createCalibrationBashToolDefinition,
} from "../research-controller/calibration-policy.mjs";
import { createExecutionLifecycle } from "../research-controller/execution-lifecycle.mjs";
import { createContextCapacitySnapshot } from "../research-controller/context-capacity.mjs";
import { createUsageTelemetry } from "../research-controller/usage-telemetry.mjs";
import { classifyTermination } from "../research-controller/termination.mjs";
import {
  buildAgentPrompt,
  buildAgentSystemPrompt,
  renderMechanicalProfilerEvidence,
} from "../research-controller/prompt-builder.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");
const PROVIDER = "cslab";
const BASE_URL = "https://llm.cs.cityu.edu.hk/v1";
const MODEL_ID = "CS/DeepSeek-V4-Flash-FP8";
const TOOLS = ["read", "grep", "edit", "write", "bash"];
const MODES = {
  m5c: {
    taskId: "sympy__sympy-20228",
    revision: "c237fe7f4c1a4abcfaef0e79600e26cba4ac0a6d",
    evidenceSeries: "m5c",
    protocolVersion: AGENT_EXECUTION_PROTOCOL_VERSION,
    resourceControl: AGENT_RESOURCE_CONTROL,
    createBashTool: createPolicyBashToolDefinition,
  },
  "m5d-fast": {
    taskId: "sympy__sympy-21391",
    revision: "8ddf9c29e345df987e82f8c5905dd0b32ea0a4b6",
    evidenceSeries: "m5d",
    protocolVersion: FAST_SANITY_PROTOCOL_VERSION,
    resourceControl: FAST_SANITY_RESOURCE_CONTROL,
    createBashTool: createFastSanityBashToolDefinition,
  },
  "m5j-calibration": {
    taskId: "sympy__sympy-21391",
    revision: "8ddf9c29e345df987e82f8c5905dd0b32ea0a4b6",
    evidenceSeries: "m5j",
    protocolVersion: CALIBRATION_PROTOCOL_VERSION,
    resourceControl: CALIBRATION_RESOURCE_CONTROL,
    createBashTool: createCalibrationBashToolDefinition,
  },
};

function parseArguments(argv) {
  const options = {
    group: undefined,
    workspace: undefined,
    profile: undefined,
    experimentId: undefined,
    mode: "m5c",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (["--group", "--workspace", "--profile", "--experiment-id", "--mode"].includes(key) && value) {
      const property = {
        "--group": "group",
        "--workspace": "workspace",
        "--profile": "profile",
        "--experiment-id": "experimentId",
        "--mode": "mode",
      }[key];
      options[property] = value;
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${key}`);
    }
  }
  if (!['B0', 'B1'].includes(options.group)) throw new Error("--group must be B0 or B1");
  if (!MODES[options.mode]) throw new Error("--mode must be m5c, m5d-fast, or m5j-calibration");
  if (!options.workspace || !options.experimentId) throw new Error("--workspace and --experiment-id are required");
  if (options.group === "B1" && !options.profile) throw new Error("B1 requires --profile");
  return {
    ...options,
    workspace: resolve(options.workspace),
    profile: options.profile ? resolve(options.profile) : undefined,
  };
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
    child.once("close", (exitCode) => resolvePromise({
      command: [command, ...args].join(" "),
      exitCode,
      elapsedMs: Math.round(performance.now() - started),
      stdout,
      stderr,
    }));
  });
}

async function findGitBash() {
  const explicit = process.env.PI_BASH_PATH;
  if (explicit && existsSync(explicit)) return explicit;
  const whereGit = await run("where.exe", ["git.exe"], ROOT);
  if (whereGit.exitCode === 0) {
    for (const line of whereGit.stdout.split(/\r?\n/u)) {
      if (!line.trim()) continue;
      const candidate = resolve(dirname(line.trim()), "..", "bin", "bash.exe");
      if (existsSync(candidate)) return candidate;
    }
  }
  throw new Error("Git Bash was not found. Set PI_BASH_PATH.");
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

function messageText(message) {
  if (typeof message?.content === "string") return message.content;
  if (!Array.isArray(message?.content)) return "";
  return message.content.filter((item) => item?.type === "text").map((item) => item.text).join("\n");
}

function toolResultText(result) {
  if (!Array.isArray(result?.content)) return "";
  return result.content.filter((item) => item?.type === "text").map((item) => item.text).join("\n");
}

async function main() {
  if (process.platform !== "win32") throw new Error("M5 is Native Windows only");
  const options = parseArguments(process.argv.slice(2));
  const mode = MODES[options.mode];
  const apiKey = process.env.CSLAB_API_KEY;
  if (!apiKey) throw new Error("CSLAB_API_KEY is missing from the current process");
  if (!existsSync(options.workspace)) throw new Error(`Workspace missing: ${options.workspace}`);
  const resourceControl = mode.resourceControl;
  const taskPath = join(ROOT, "experiments", "tasks", mode.taskId, "agent", "task.md");

  const evidenceDir = join(ROOT, "results", "raw", mode.evidenceSeries, options.experimentId, options.group);
  await mkdir(evidenceDir, { recursive: true });
  const revisionResult = await run("git.exe", ["rev-parse", "HEAD"], options.workspace);
  const initialStatus = await run("git.exe", ["status", "--porcelain"], options.workspace);
  if (revisionResult.exitCode !== 0 || revisionResult.stdout.trim() !== mode.revision) throw new Error("Unexpected workspace revision");
  if (initialStatus.exitCode !== 0 || initialStatus.stdout.trim()) throw new Error("Agent workspace must start clean");

  const taskDescription = await readFile(taskPath, "utf8");
  const profileDocument = options.profile ? JSON.parse(await readFile(options.profile, "utf8")) : undefined;
  const profilerEvidence = profileDocument ? renderMechanicalProfilerEvidence(profileDocument) : "";
  const prompt = buildAgentPrompt({
    taskDescription,
    performanceContext: options.group === "B1" ? profilerEvidence : "",
    resourceControl,
    runClassification: options.mode === "m5d-fast" || options.mode === "m5j-calibration"
      ? "development sanity check, not a formal performance experiment"
      : "preliminary experiment",
  });
  const systemPrompt = buildAgentSystemPrompt();
  await writeFile(join(evidenceDir, "prompt.md"), prompt, "utf8");
  await writeFile(join(evidenceDir, "system-prompt.md"), systemPrompt, "utf8");

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
      maxTokens: resourceControl.modelResponse.maxOutputTokensPerResponse,
    }],
  });
  await modelRuntime.setRuntimeApiKey(PROVIDER, apiKey);
  const model = modelRuntime.getModel(PROVIDER, MODEL_ID);
  if (!model) throw new Error("Configured CSLab model is unavailable");

  const settingsManager = SettingsManager.inMemory({
    compaction: { enabled: false },
    retry: { enabled: false },
    shellPath: gitBash,
  });
  const policyBashTool = mode.createBashTool(options.workspace, { shellPath: gitBash });
  const { session } = await createAgentSession({
    cwd: options.workspace,
    model,
    thinkingLevel: "off",
    modelRuntime,
    resourceLoader: createResourceLoader(systemPrompt),
    tools: TOOLS,
    customTools: [policyBashTool],
    sessionManager: SessionManager.inMemory(options.workspace),
    settingsManager,
  });

  const events = [];
  const toolSequence = [];
  const contextSnapshots = [];
  const usageTelemetry = createUsageTelemetry();
  const startedAt = new Date();
  const started = performance.now();
  const lifecycle = createExecutionLifecycle({
    executionBudget: resourceControl.execution,
    emergencyProviderUsageCap: resourceControl.usage.emergencyProviderUsageCap,
    usageTelemetry,
    abortRun: () => session.abort(),
  });
  lifecycle.install(session.agent);
  const unsubscribe = session.subscribe((event) => {
    const base = { atMs: Math.round(performance.now() - started), type: event.type };
    if (event.type === "tool_execution_start") {
      toolSequence.push(event.toolName);
      events.push({
        ...base,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
        controllerDefaults: event.toolName === "bash" ? {
          bashTimeoutSeconds: event.args?.timeout ?? resourceControl.toolSafety.bashDefaultTimeoutSeconds,
          timeoutInjected: event.args?.timeout === undefined,
        } : undefined,
      });
    } else if (event.type === "tool_execution_end") {
      events.push({ ...base, toolCallId: event.toolCallId, toolName: event.toolName, isError: event.isError, result: { isError: event.result?.isError === true, text: toolResultText(event.result) } });
    } else if (event.type === "message_end") {
      events.push({ ...base, role: event.message?.role, stopReason: event.message?.stopReason, usage: event.message?.usage, text: messageText(event.message) });
    } else if (["agent_start", "turn_start", "turn_end", "agent_end", "agent_settled"].includes(event.type)) {
      events.push(base);
      if (event.type === "turn_end") {
        contextSnapshots.push({
          atMs: base.atMs,
          ...createContextCapacitySnapshot({
            contextUsage: session.getContextUsage(),
            contextWindow: model.contextWindow,
            reserveTokens: resourceControl.context.reserveTokens,
          }),
        });
      }
    }
  });

  let promptError;
  const timeout = lifecycle.startWallClockTimer();
  try {
    await session.prompt(prompt);
  } catch (error) {
    promptError = error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) };
  } finally {
    clearTimeout(timeout);
  }

  const elapsedMs = Math.round(performance.now() - started);
  const stats = session.getSessionStats();
  const lifecycleState = lifecycle.state;
  const usage = usageTelemetry.snapshot();
  const finalContext = createContextCapacitySnapshot({
    contextUsage: session.getContextUsage(),
    contextWindow: model.contextWindow,
    reserveTokens: resourceControl.context.reserveTokens,
  });
  const transcript = session.messages;
  const terminalAssistant = transcript.filter((message) => message.role === "assistant").at(-1) ?? null;
  const terminationReason = classifyTermination(lifecycleState, terminalAssistant);
  const finalAssistantText = session.getLastAssistantText();
  const activeTools = session.getActiveToolNames();
  unsubscribe();
  session.dispose();

  const untracked = await run("git.exe", ["ls-files", "--others", "--exclude-standard"], options.workspace);
  const untrackedFiles = untracked.stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  if (untrackedFiles.length) await run("git.exe", ["add", "-N", "--", ...untrackedFiles], options.workspace);
  const finalStatus = await run("git.exe", ["status", "--short"], options.workspace);
  const changedFiles = await run("git.exe", ["diff", "--name-only", "HEAD", "--"], options.workspace);
  const changedFileList = changedFiles.stdout.split(/\r?\n/u).filter(Boolean);
  const sourcePatchFiles = changedFileList.filter((path) => {
    const normalized = path.replaceAll("\\", "/").toLowerCase();
    return normalized.endsWith(".py") && !normalized.includes("/tests/") && !normalized.startsWith("tests/");
  });
  const patch = await run("git.exe", ["diff", "--binary", "HEAD", "--"], options.workspace);
  const patchPresent = sourcePatchFiles.length > 0;
  const testPattern = /(?:\bbin\/test\b|\bpytest\b|\bunittest\b|\btox\b)/iu;
  const agentDrivenTests = events
    .filter((event) => event.type === "tool_execution_start" && event.toolName === "bash" && testPattern.test(event.args?.command ?? ""))
    .map((startEvent) => {
      const endEvent = events.find((event) => event.type === "tool_execution_end" && event.toolCallId === startEvent.toolCallId);
      return {
        toolCallId: startEvent.toolCallId,
        command: startEvent.args.command,
        effectiveTimeoutSeconds: startEvent.controllerDefaults.bashTimeoutSeconds,
        completed: Boolean(endEvent),
        isError: endEvent?.isError ?? null,
      };
    });
  const pythonVersion = await run(join(options.workspace, ".venv", "Scripts", "python.exe"), ["--version"], options.workspace);
  const dependencies = await run(join(options.workspace, ".venv", "Scripts", "python.exe"), ["-m", "pip", "freeze"], options.workspace);

  await writeFile(join(evidenceDir, "events.jsonl"), `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");
  await writeFile(join(evidenceDir, "transcript.json"), `${JSON.stringify(transcript, null, 2)}\n`, "utf8");
  await writeFile(join(evidenceDir, "patch.diff"), patch.stdout, "utf8");
  await writeFile(join(evidenceDir, "git-status.txt"), finalStatus.stdout, "utf8");
  await writeFile(join(evidenceDir, "changed-files.txt"), changedFiles.stdout, "utf8");
  await writeFile(join(evidenceDir, "usage-telemetry.json"), `${JSON.stringify(usage, null, 2)}\n`, "utf8");

  const summary = {
    schemaVersion: 2,
    experimentId: options.experimentId,
    group: options.group,
    preliminary: true,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    elapsedMs,
    promptError,
    terminationReason,
    attemptOutcome: patchPresent ? "PATCH_PRODUCED" : "NO_PATCH",
    executionProtocol: { version: mode.protocolVersion, developmentOnly: options.mode !== "m5c" },
    resourceControl,
    execution: { budget: resourceControl.execution, lifecycle: lifecycleState },
    context: { policy: resourceControl.context, snapshots: contextSnapshots, final: finalContext },
    usage,
    termination: {
      reason: terminationReason,
      kind: lifecycleState.stopKind ?? (terminationReason === "assistant_complete" ? "natural" : "model"),
      rawModelStopReason: terminalAssistant?.stopReason ?? null,
    },
    environment: { platform: process.platform, node: process.version, python: pythonVersion, dependencies, gitBash, apiKeySource: "process.env.CSLAB_API_KEY", apiKeyRecorded: false },
    agent: { harness: "@earendil-works/pi-coding-agent@1.0.3", provider: PROVIDER, baseUrl: BASE_URL, model: MODEL_ID, thinkingLevel: "off", activeTools, toolSequence, assistantMessages: lifecycleState.modelTurns, finalAssistantText, stats, agentDrivenTests },
    repository: { path: options.workspace, revision: mode.revision, initialClean: true, finalStatus: finalStatus.stdout, changedFiles: changedFileList, sourcePatchFiles, untrackedFiles },
    inputs: { taskPath, taskId: mode.taskId, promptMode: "unified-performance-action-v1", profilerEvidenceSupplied: options.group === "B1", profilerSource: options.profile ?? null, evaluatorOrGoldSupplied: false },
    artifacts: { evidenceDir, events: join(evidenceDir, "events.jsonl"), transcript: join(evidenceDir, "transcript.json"), usage: join(evidenceDir, "usage-telemetry.json"), patch: join(evidenceDir, "patch.diff") },
  };
  await writeFile(join(evidenceDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ group: options.group, elapsedMs, promptError, terminationReason, attemptOutcome: summary.attemptOutcome, toolCalls: lifecycleState.toolCalls, turns: lifecycleState.modelTurns, usage: usage.totals, context: finalContext, agentDrivenTests, changedFiles: summary.repository.changedFiles, evidenceDir }, null, 2));
  if (promptError) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});

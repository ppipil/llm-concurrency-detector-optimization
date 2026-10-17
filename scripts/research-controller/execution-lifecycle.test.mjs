import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { Agent } from "@earendil-works/pi-agent-core";
import {
  createFauxCore,
  fauxAssistantMessage,
  fauxToolCall,
} from "@earendil-works/pi-ai/providers/faux";
import { Type } from "typebox";

import { createExecutionLifecycle } from "./execution-lifecycle.mjs";
import { createPolicyBashToolDefinition } from "./execution-policy.mjs";
import { createUsageTelemetry } from "./usage-telemetry.mjs";

function testBudget(overrides = {}) {
  return {
    wallClockMs: 10_000,
    toolCalls: 10,
    modelTurns: 10,
    ...overrides,
  };
}

function tool(name, execute) {
  return {
    name,
    label: name,
    description: `${name} test tool`,
    parameters: Type.Object({ value: Type.Optional(Type.String()) }),
    execute,
  };
}

function createMockRun({ responses, tools, budget, emergencyProviderUsageCap = null, toolExecution = "sequential" }) {
  const faux = createFauxCore({
    api: `m5e-faux-${Math.random()}`,
    provider: "m5e-test",
    tokenSize: { min: 1000, max: 1000 },
  });
  faux.setResponses(responses);
  const agent = new Agent({
    initialState: {
      systemPrompt: "M5e deterministic lifecycle test",
      model: faux.getModel(),
      thinkingLevel: "off",
      tools,
      messages: [],
    },
    streamFn: faux.streamSimple,
    toolExecution,
  });
  const usageTelemetry = createUsageTelemetry();
  const lifecycle = createExecutionLifecycle({
    executionBudget: budget,
    emergencyProviderUsageCap,
    usageTelemetry,
    abortRun: () => agent.abort(),
  });
  lifecycle.install(agent);
  return { agent, faux, lifecycle, usageTelemetry };
}

test("last allowed model turn completes an edit and stops before another model request", async () => {
  const events = [];
  let editCompleted = false;
  const edit = tool("edit", async () => {
    await Promise.resolve();
    editCompleted = true;
    return { content: [{ type: "text", text: "edit complete" }] };
  });
  const run = createMockRun({
    responses: [
      fauxAssistantMessage(fauxToolCall("edit", { value: "patch" }), { stopReason: "toolUse" }),
      fauxAssistantMessage("must not be requested"),
    ],
    tools: [edit],
    budget: testBudget({ modelTurns: 1 }),
  });
  run.agent.subscribe((event) => events.push(event.type));

  await run.agent.prompt("edit now");

  assert.equal(editCompleted, true);
  assert.equal(run.faux.state.callCount, 1);
  assert.equal(run.lifecycle.state.stopReason, "model_turn_budget");
  assert.equal(run.lifecycle.state.stopKind, "soft");
  assert.equal(run.agent.state.messages.some((message) => message.role === "toolResult" && message.toolName === "edit"), true);
  assert.ok(events.indexOf("tool_execution_end") < events.indexOf("agent_end"));
});

test("last allowed model turn completes bash and stops before another model request", async () => {
  let bashCompleted = false;
  const bash = tool("bash", async () => {
    bashCompleted = true;
    return { content: [{ type: "text", text: "bash complete" }] };
  });
  const run = createMockRun({
    responses: [
      fauxAssistantMessage(fauxToolCall("bash", { value: "test" }), { stopReason: "toolUse" }),
      fauxAssistantMessage("must not be requested"),
    ],
    tools: [bash],
    budget: testBudget({ modelTurns: 1 }),
  });

  await run.agent.prompt("run bash");

  assert.equal(bashCompleted, true);
  assert.equal(run.faux.state.callCount, 1);
  assert.equal(run.lifecycle.state.stopReason, "model_turn_budget");
  assert.equal(run.agent.state.messages.some((message) => message.role === "toolResult" && message.toolName === "bash"), true);
});

test("last allowed model turn without a tool ends naturally without an abort", async () => {
  const run = createMockRun({
    responses: [fauxAssistantMessage("finished", { stopReason: "stop" })],
    tools: [],
    budget: testBudget({ modelTurns: 1 }),
  });

  await run.agent.prompt("finish");

  assert.equal(run.faux.state.callCount, 1);
  assert.equal(run.lifecycle.state.modelTurns, 1);
  assert.equal(run.lifecycle.state.stopReason, null);
  assert.equal(run.lifecycle.state.hardStopRequested, false);
});

test("Nth allowed tool call completes and N+1 is blocked before its implementation starts", async () => {
  const executed = [];
  const action = tool("action", async (_id, { value }) => {
    executed.push(value);
    return { content: [{ type: "text", text: `completed ${value}` }] };
  });
  const run = createMockRun({
    responses: [
      fauxAssistantMessage([
        fauxToolCall("action", { value: "allowed" }, { id: "allowed" }),
        fauxToolCall("action", { value: "blocked" }, { id: "blocked" }),
      ], { stopReason: "toolUse" }),
      fauxAssistantMessage("must not be requested"),
    ],
    tools: [action],
    budget: testBudget({ toolCalls: 1 }),
  });

  await run.agent.prompt("two calls");

  assert.deepEqual(executed, ["allowed"]);
  assert.equal(run.lifecycle.state.toolCalls, 1);
  assert.equal(run.lifecycle.state.blockedToolCalls, 1);
  assert.equal(run.lifecycle.state.stopReason, "tool_call_budget");
  assert.equal(run.faux.state.callCount, 1);
});

test("provider total above the old ceilings does not stop the action loop", async () => {
  let completed = false;
  const edit = tool("edit", async () => {
    completed = true;
    return { content: [{ type: "text", text: "done" }] };
  });
  const run = createMockRun({
    responses: [
      fauxAssistantMessage(fauxToolCall("edit", { value: "patch" }), { stopReason: "toolUse" }),
      fauxAssistantMessage("completed after high provider usage"),
    ],
    tools: [edit],
    budget: testBudget(),
  });

  await run.agent.prompt(`continue despite provider throughput ${"x".repeat(500_000)}`);

  assert.equal(completed, true);
  assert.equal(run.lifecycle.state.stopReason, null);
  assert.equal(run.faux.state.callCount, 2);
  assert.ok(run.usageTelemetry.snapshot().totals.providerTotal > 100_000);
});

test("optional emergency provider cap stops at the response boundary after the legal tool", async () => {
  let completed = false;
  const edit = tool("edit", async () => {
    completed = true;
    return { content: [{ type: "text", text: "done" }] };
  });
  const run = createMockRun({
    responses: [
      fauxAssistantMessage(fauxToolCall("edit", { value: "patch" }), { stopReason: "toolUse" }),
      fauxAssistantMessage("must not be requested"),
    ],
    tools: [edit],
    budget: testBudget(),
    emergencyProviderUsageCap: 1,
  });

  await run.agent.prompt("emergency boundary");

  assert.equal(completed, true);
  assert.equal(run.lifecycle.state.stopReason, "emergency_provider_usage_cap");
  assert.equal(run.lifecycle.state.stopKind, "soft");
  assert.equal(run.faux.state.callCount, 1);
});

test("wall-clock hard stop aborts an in-flight tool", async () => {
  let toolStarted = false;
  let toolObservedAbort = false;
  const longTool = tool("long", async (_id, _args, signal) => {
    toolStarted = true;
    return new Promise((resolvePromise, rejectPromise) => {
      const abort = () => {
        toolObservedAbort = true;
        rejectPromise(new Error("hard-aborted"));
      };
      if (signal?.aborted) abort();
      else signal?.addEventListener("abort", abort, { once: true });
    });
  });
  const run = createMockRun({
    responses: [fauxAssistantMessage(fauxToolCall("long", {}), { stopReason: "toolUse" })],
    tools: [longTool],
    budget: testBudget(),
  });
  const timer = run.lifecycle.startWallClockTimer(25);

  try {
    await run.agent.prompt("wait");
  } finally {
    clearTimeout(timer);
  }

  assert.equal(toolStarted, true);
  assert.equal(toolObservedAbort, true);
  assert.equal(run.lifecycle.state.stopReason, "wall_clock_budget");
  assert.equal(run.lifecycle.state.stopKind, "hard");
});

test("external cancellation uses the same immediate hard-stop path", async () => {
  let abortCalls = 0;
  const lifecycle = createExecutionLifecycle({
    executionBudget: testBudget(),
    usageTelemetry: createUsageTelemetry(),
    abortRun: () => { abortCalls += 1; },
  });

  lifecycle.requestHardStop("external_cancel");
  lifecycle.requestHardStop("external_cancel");

  assert.equal(abortCalls, 1);
  assert.equal(lifecycle.state.stopReason, "external_cancel");
  assert.equal(lifecycle.state.stopKind, "hard");
});

test("Pi local bash timeout terminates a real native-Windows child process", async (t) => {
  if (process.platform !== "win32") return t.skip("Native Windows integration test");
  const where = spawnSync("where.exe", ["git.exe"], { encoding: "utf8", windowsHide: true });
  const gitPath = where.stdout.split(/\r?\n/u).map((line) => line.trim()).find(Boolean);
  const bashPath = gitPath ? resolve(dirname(gitPath), "..", "bin", "bash.exe") : undefined;
  if (!bashPath || !existsSync(bashPath)) return t.skip("Git Bash is unavailable");

  const definition = createPolicyBashToolDefinition(process.cwd(), { shellPath: bashPath });
  const started = performance.now();
  await assert.rejects(
    definition.execute("timeout-test", { command: "sleep 2", timeout: 0.05 }, new AbortController().signal),
    /Command timed out after 0\.05 seconds/u,
  );
  assert.ok(performance.now() - started < 1500, "timed-out command should be killed promptly");
});

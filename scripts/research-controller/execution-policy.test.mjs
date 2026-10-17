import assert from "node:assert/strict";
import test from "node:test";

import {
  AGENT_RESOURCE_CONTROL,
  AGENT_EXECUTION_PROTOCOL_VERSION,
  createPolicyBashToolDefinition,
  withDefaultBashTimeout,
} from "./execution-policy.mjs";

test("formal resource control has the approved execution and safety limits", () => {
  assert.equal(AGENT_EXECUTION_PROTOCOL_VERSION, "agent-execution-v2");
  assert.deepEqual(AGENT_RESOURCE_CONTROL, {
    execution: { modelTurns: 12, toolCalls: 20, wallClockMs: 600_000 },
    toolSafety: { bashDefaultTimeoutSeconds: 60 },
    context: { reserveTokens: 16_384, mode: "monitor_only" },
    usage: { emergencyProviderUsageCap: null },
    modelResponse: { maxOutputTokensPerResponse: 8192 },
  });
  assert.equal(Object.isFrozen(AGENT_RESOURCE_CONTROL), true);
  for (const value of Object.values(AGENT_RESOURCE_CONTROL)) assert.equal(Object.isFrozen(value), true);
  assert.equal("accountedTokens" in AGENT_RESOURCE_CONTROL.execution, false);
});

test("bash wrapper injects the default timeout when the model omits it", async () => {
  let received;
  const wrapped = withDefaultBashTimeout({
    async exec(command, cwd, options) {
      received = { command, cwd, options };
      return { exitCode: 0 };
    },
  });
  await wrapped.exec("echo ok", "C:/repo", { onData() {}, env: {} });
  assert.equal(received.options.timeout, 60);
});

test("bash wrapper preserves an explicit model timeout", async () => {
  let receivedTimeout;
  const wrapped = withDefaultBashTimeout({
    async exec(_command, _cwd, options) {
      receivedTimeout = options.timeout;
      return { exitCode: 0 };
    },
  });
  await wrapped.exec("echo ok", "C:/repo", { onData() {}, timeout: 15 });
  assert.equal(receivedTimeout, 15);
});

test("Pi bash tool definition uses the controller timeout wrapper", async () => {
  let receivedTimeout;
  const definition = createPolicyBashToolDefinition("C:/repo", {
    operations: {
      async exec(_command, _cwd, options) {
        receivedTimeout = options.timeout;
        return { exitCode: 0 };
      },
    },
  });
  const result = await definition.execute("test-call", { command: "echo ok" }, new AbortController().signal);
  assert.equal(definition.name, "bash");
  assert.equal(receivedTimeout, 60);
  assert.equal(result.isError, undefined);
});

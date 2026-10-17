import assert from "node:assert/strict";
import test from "node:test";

import {
  FAST_SANITY_RESOURCE_CONTROL,
  FAST_SANITY_PROTOCOL_VERSION,
  createFastSanityBashToolDefinition,
} from "./fast-sanity-policy.mjs";

test("FAST resource control is separate, frozen, and uses the approved limits", () => {
  assert.equal(FAST_SANITY_PROTOCOL_VERSION, "fast-sanity-v2");
  assert.deepEqual(FAST_SANITY_RESOURCE_CONTROL, {
    execution: { modelTurns: 8, toolCalls: 12, wallClockMs: 240_000 },
    toolSafety: { bashDefaultTimeoutSeconds: 30 },
    context: { reserveTokens: 16_384, mode: "monitor_only" },
    usage: { emergencyProviderUsageCap: null },
    modelResponse: { maxOutputTokensPerResponse: 8192 },
  });
  assert.equal("accountedTokens" in FAST_SANITY_RESOURCE_CONTROL.execution, false);
});

test("FAST Pi bash definition injects 30 seconds", async () => {
  let receivedTimeout;
  const definition = createFastSanityBashToolDefinition("C:/repo", {
    operations: {
      async exec(_command, _cwd, options) {
        receivedTimeout = options.timeout;
        return { exitCode: 0 };
      },
    },
  });
  await definition.execute("test-call", { command: "echo ok" }, new AbortController().signal);
  assert.equal(receivedTimeout, 30);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  CALIBRATION_PROTOCOL_VERSION,
  CALIBRATION_RESOURCE_CONTROL,
  createCalibrationBashToolDefinition,
} from "./calibration-policy.mjs";

test("diagnostic calibration policy changes only the requested resource limits", () => {
  assert.equal(CALIBRATION_PROTOCOL_VERSION, "diagnostic-calibration-v2");
  assert.deepEqual(CALIBRATION_RESOURCE_CONTROL, {
    execution: { modelTurns: 30, toolCalls: 45, wallClockMs: 600_000 },
    toolSafety: { bashDefaultTimeoutSeconds: 60 },
    context: { reserveTokens: 16_384, mode: "monitor_only" },
    usage: { emergencyProviderUsageCap: null },
    modelResponse: { maxOutputTokensPerResponse: 8192 },
  });
});

test("diagnostic calibration bash definition injects 60 seconds", async () => {
  let receivedTimeout;
  const definition = createCalibrationBashToolDefinition("C:/repo", {
    operations: {
      async exec(_command, _cwd, options) {
        receivedTimeout = options.timeout;
        return { exitCode: 0 };
      },
    },
  });
  await definition.execute("test-call", { command: "echo ok" }, new AbortController().signal);
  assert.equal(receivedTimeout, 60);
});

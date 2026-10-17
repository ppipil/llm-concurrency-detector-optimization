import {
  createBashToolDefinition,
  createLocalBashOperations,
} from "@earendil-works/pi-coding-agent";

import { DEFAULT_CONTEXT_RESERVE_TOKENS } from "./context-capacity.mjs";
import { withDefaultBashTimeout } from "./execution-policy.mjs";

export const CALIBRATION_PROTOCOL_VERSION = "diagnostic-calibration-v2";

// Diagnostic capability calibration only. This does not replace either frozen policy.
export const CALIBRATION_RESOURCE_CONTROL = Object.freeze({
  execution: Object.freeze({
    modelTurns: 30,
    toolCalls: 45,
    wallClockMs: 10 * 60 * 1000,
  }),
  toolSafety: Object.freeze({
    bashDefaultTimeoutSeconds: 60,
  }),
  context: Object.freeze({
    reserveTokens: DEFAULT_CONTEXT_RESERVE_TOKENS,
    mode: "monitor_only",
  }),
  usage: Object.freeze({
    emergencyProviderUsageCap: null,
  }),
  modelResponse: Object.freeze({
    maxOutputTokensPerResponse: 8192,
  }),
});

export function createCalibrationBashToolDefinition(cwd, { shellPath, operations } = {}) {
  const baseOperations = operations ?? createLocalBashOperations({ shellPath });
  return createBashToolDefinition(cwd, {
    shellPath,
    operations: withDefaultBashTimeout(
      baseOperations,
      CALIBRATION_RESOURCE_CONTROL.toolSafety.bashDefaultTimeoutSeconds,
    ),
  });
}

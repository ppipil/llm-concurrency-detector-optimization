import {
  createBashToolDefinition,
  createLocalBashOperations,
} from "@earendil-works/pi-coding-agent";

import { DEFAULT_CONTEXT_RESERVE_TOKENS } from "./context-capacity.mjs";

export const AGENT_EXECUTION_PROTOCOL_VERSION = "agent-execution-v2";

export const AGENT_RESOURCE_CONTROL = Object.freeze({
  execution: Object.freeze({
    modelTurns: 12,
    toolCalls: 20,
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

export function withDefaultBashTimeout(
  operations,
  defaultTimeoutSeconds = AGENT_RESOURCE_CONTROL.toolSafety.bashDefaultTimeoutSeconds,
) {
  if (!Number.isFinite(defaultTimeoutSeconds) || defaultTimeoutSeconds <= 0) {
    throw new Error("defaultTimeoutSeconds must be a positive finite number");
  }
  return {
    exec(command, cwd, options) {
      return operations.exec(command, cwd, {
        ...options,
        timeout: options.timeout ?? defaultTimeoutSeconds,
      });
    },
  };
}

export function createPolicyBashToolDefinition(cwd, { shellPath, operations } = {}) {
  const baseOperations = operations ?? createLocalBashOperations({ shellPath });
  return createBashToolDefinition(cwd, {
    shellPath,
    operations: withDefaultBashTimeout(baseOperations),
  });
}

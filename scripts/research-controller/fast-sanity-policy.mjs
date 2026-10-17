import {
  createBashToolDefinition,
  createLocalBashOperations,
} from "@earendil-works/pi-coding-agent";

import { DEFAULT_CONTEXT_RESERVE_TOKENS } from "./context-capacity.mjs";
import { withDefaultBashTimeout } from "./execution-policy.mjs";

export const FAST_SANITY_PROTOCOL_VERSION = "fast-sanity-v2";

// Development feedback only. This must never replace agent-execution-v2.
export const FAST_SANITY_RESOURCE_CONTROL = Object.freeze({
  execution: Object.freeze({
    modelTurns: 8,
    toolCalls: 12,
    wallClockMs: 4 * 60 * 1000,
  }),
  toolSafety: Object.freeze({
    bashDefaultTimeoutSeconds: 30,
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

export function createFastSanityBashToolDefinition(cwd, { shellPath, operations } = {}) {
  const baseOperations = operations ?? createLocalBashOperations({ shellPath });
  return createBashToolDefinition(cwd, {
    shellPath,
    operations: withDefaultBashTimeout(
      baseOperations,
      FAST_SANITY_RESOURCE_CONTROL.toolSafety.bashDefaultTimeoutSeconds,
    ),
  });
}

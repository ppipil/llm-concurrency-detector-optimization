export const DEFAULT_CONTEXT_RESERVE_TOKENS = 16_384;

export function createContextCapacitySnapshot({ contextUsage, contextWindow, reserveTokens = DEFAULT_CONTEXT_RESERVE_TOKENS }) {
  const resolvedWindow = contextWindow ?? contextUsage?.contextWindow;
  if (!Number.isFinite(resolvedWindow) || resolvedWindow <= 0) {
    throw new Error("contextWindow must be a positive finite number");
  }
  if (!Number.isFinite(reserveTokens) || reserveTokens < 0 || reserveTokens >= resolvedWindow) {
    throw new Error("reserveTokens must be non-negative and smaller than contextWindow");
  }
  const currentTokens = Number.isFinite(contextUsage?.tokens) && contextUsage.tokens >= 0
    ? contextUsage.tokens
    : null;
  const thresholdTokens = resolvedWindow - reserveTokens;
  const utilization = currentTokens === null ? null : currentTokens / resolvedWindow;

  return Object.freeze({
    contextWindow: resolvedWindow,
    currentTokens,
    reserveTokens,
    thresholdTokens,
    utilization,
    thresholdExceeded: currentTokens === null ? null : currentTokens >= thresholdTokens,
    action: "monitor_only",
    compactionEnabled: false,
  });
}

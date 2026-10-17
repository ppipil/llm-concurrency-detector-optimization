export const TERMINATION_REASONS = Object.freeze([
  "assistant_complete",
  "model_turn_budget",
  "tool_call_budget",
  "wall_clock_budget",
  "external_cancel",
  "context_capacity_guard",
  "emergency_provider_usage_cap",
]);

export function classifyTermination(lifecycleState, terminalAssistant) {
  if (lifecycleState?.stopReason) return lifecycleState.stopReason;
  if (!terminalAssistant) return "external_cancel";
  if (terminalAssistant.stopReason === "stop") return "assistant_complete";
  const modelError = terminalAssistant.errorMessage ?? terminalAssistant.rawStopReason ?? "";
  if (/context.{0,20}(?:window|length|capacity)|maximum context|too many tokens/iu.test(modelError)) {
    return "context_capacity_guard";
  }
  if (terminalAssistant.stopReason === "aborted") return "external_cancel";
  if (terminalAssistant.stopReason === "error") return `model_error:${modelError || "unknown"}`;
  return `model_stop:${terminalAssistant.stopReason ?? "unknown"}`;
}

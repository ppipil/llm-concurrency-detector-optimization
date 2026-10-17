const SOFT_STOP_REASONS = new Set([
  "model_turn_budget",
  "tool_call_budget",
  "emergency_provider_usage_cap",
]);

const HARD_STOP_REASONS = new Set([
  "wall_clock_budget",
  "external_cancel",
]);

function hasToolCalls(message) {
  return Array.isArray(message?.content) && message.content.some((item) => item?.type === "toolCall");
}

function validatePositive(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive finite number`);
}

export function createExecutionLifecycle({
  executionBudget,
  emergencyProviderUsageCap = null,
  usageTelemetry,
  abortRun,
}) {
  if (!executionBudget) throw new Error("executionBudget is required");
  validatePositive(executionBudget.modelTurns, "executionBudget.modelTurns");
  validatePositive(executionBudget.toolCalls, "executionBudget.toolCalls");
  validatePositive(executionBudget.wallClockMs, "executionBudget.wallClockMs");
  if (emergencyProviderUsageCap !== null) {
    validatePositive(emergencyProviderUsageCap, "emergencyProviderUsageCap");
  }
  if (!usageTelemetry || typeof usageTelemetry.recordProviderResponse !== "function") {
    throw new Error("usageTelemetry is required");
  }
  if (typeof abortRun !== "function") throw new Error("abortRun must be a function");

  let modelTurns = 0;
  let toolCalls = 0;
  let blockedToolCalls = 0;
  let stopReason = null;
  let stopKind = null;
  let hardStopRequested = false;
  let installed = false;

  const recordSoftStop = (reason) => {
    if (!SOFT_STOP_REASONS.has(reason)) throw new Error(`Unknown soft-stop reason: ${reason}`);
    if (!stopReason) {
      stopReason = reason;
      stopKind = "soft";
    }
  };

  const beforeToolCall = () => {
    if (hardStopRequested) {
      return {
        block: true,
        reason: `Tool execution blocked after hard stop: ${stopReason}`,
        terminate: true,
      };
    }
    if (toolCalls >= executionBudget.toolCalls) {
      blockedToolCalls += 1;
      recordSoftStop("tool_call_budget");
      return {
        block: true,
        reason: "Tool call budget exhausted before this call; the tool implementation was not started.",
        terminate: true,
      };
    }
    toolCalls += 1;
    return undefined;
  };

  const finishTurn = (turn) => {
    const message = turn?.message;
    if (!message) return undefined;

    usageTelemetry.recordProviderResponse(message);
    if (message.stopReason === "error" || message.stopReason === "aborted") return undefined;

    modelTurns += 1;

    // A natural terminal response needs no budget stop. For tool-use responses, finishTurn runs
    // only after every allowed tool result has been finalized and persisted, which is the safe
    // boundary at which to prevent the next provider request.
    if (!hasToolCalls(message) && message.stopReason === "stop") return undefined;

    if (modelTurns >= executionBudget.modelTurns) recordSoftStop("model_turn_budget");
    else if (toolCalls >= executionBudget.toolCalls) recordSoftStop("tool_call_budget");
    else if (emergencyProviderUsageCap !== null &&
      usageTelemetry.snapshot().totals.providerTotal >= emergencyProviderUsageCap) {
      recordSoftStop("emergency_provider_usage_cap");
    }

    return stopKind === "soft" ? { action: "end" } : undefined;
  };

  const requestHardStop = (reason) => {
    if (!HARD_STOP_REASONS.has(reason)) throw new Error(`Unknown hard-stop reason: ${reason}`);
    if (hardStopRequested) return;
    hardStopRequested = true;
    stopReason = reason;
    stopKind = "hard";
    void abortRun();
  };

  const startWallClockTimer = (timeoutMs = executionBudget.wallClockMs) => {
    validatePositive(timeoutMs, "wall-clock timeout");
    return setTimeout(() => requestHardStop("wall_clock_budget"), timeoutMs);
  };

  const install = (agent) => {
    if (installed) throw new Error("execution lifecycle is already installed");
    installed = true;

    const previousBeforeToolCall = agent.beforeToolCall;
    agent.beforeToolCall = async (context, signal) => {
      const budgetDecision = beforeToolCall();
      if (budgetDecision) return budgetDecision;
      return previousBeforeToolCall?.(context, signal);
    };

    const previousFinishTurn = agent.finishTurn;
    agent.finishTurn = async (turn, signal) => {
      const previousDecision = await previousFinishTurn?.(turn, signal);
      const budgetDecision = finishTurn(turn);
      if (budgetDecision?.action === "end") return budgetDecision;
      return previousDecision;
    };
  };

  return {
    install,
    requestHardStop,
    startWallClockTimer,
    get state() {
      return Object.freeze({
        modelTurns,
        toolCalls,
        blockedToolCalls,
        stopReason,
        stopKind,
        hardStopRequested,
      });
    },
  };
}

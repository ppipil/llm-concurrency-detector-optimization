import assert from "node:assert/strict";
import test from "node:test";

import { classifyTermination, TERMINATION_REASONS } from "./termination.mjs";

test("termination taxonomy includes the required resource-control reasons", () => {
  assert.deepEqual(TERMINATION_REASONS, [
    "assistant_complete",
    "model_turn_budget",
    "tool_call_budget",
    "wall_clock_budget",
    "external_cancel",
    "context_capacity_guard",
    "emergency_provider_usage_cap",
  ]);
});

test("termination classification separates natural completion and context capacity failures", () => {
  assert.equal(classifyTermination({ stopReason: null }, { stopReason: "stop" }), "assistant_complete");
  assert.equal(classifyTermination({ stopReason: null }, {
    stopReason: "error",
    errorMessage: "maximum context length exceeded",
  }), "context_capacity_guard");
  assert.equal(classifyTermination({ stopReason: "model_turn_budget" }, { stopReason: "toolUse" }), "model_turn_budget");
});

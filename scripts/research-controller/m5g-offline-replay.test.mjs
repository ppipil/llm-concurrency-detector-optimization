import assert from "node:assert/strict";
import test from "node:test";

import { createContextCapacitySnapshot } from "./context-capacity.mjs";
import { FAST_SANITY_RESOURCE_CONTROL } from "./fast-sanity-policy.mjs";

const FIXTURES = [
  { group: "B0", modelTurns: 7, toolCalls: 11, elapsedMs: 58_085, providerTotal: 60_016, currentContext: 14_713 },
  { group: "B1", modelTurns: 6, toolCalls: 10, elapsedMs: 37_187, providerTotal: 63_738, currentContext: 13_021 },
];

test("M5g checkpoints remain actionable under the new FAST resource control", () => {
  const { execution, usage, context } = FAST_SANITY_RESOURCE_CONTROL;
  assert.equal(usage.emergencyProviderUsageCap, null);

  for (const fixture of FIXTURES) {
    const contextSnapshot = createContextCapacitySnapshot({
      contextUsage: { tokens: fixture.currentContext, contextWindow: 128_000 },
      reserveTokens: context.reserveTokens,
    });
    assert.ok(fixture.modelTurns < execution.modelTurns, `${fixture.group} should have model turns left`);
    assert.ok(fixture.toolCalls < execution.toolCalls, `${fixture.group} should have tool calls left`);
    assert.ok(fixture.elapsedMs < execution.wallClockMs, `${fixture.group} should have wall-clock left`);
    assert.equal(contextSnapshot.thresholdExceeded, false);
    assert.ok(fixture.providerTotal > 60_000);
  }
});

test("M5g replay preserves the observed remaining execution resources", () => {
  const execution = FAST_SANITY_RESOURCE_CONTROL.execution;
  const remaining = FIXTURES.map((fixture) => ({
    group: fixture.group,
    modelTurns: execution.modelTurns - fixture.modelTurns,
    toolCalls: execution.toolCalls - fixture.toolCalls,
    wallClockMs: execution.wallClockMs - fixture.elapsedMs,
  }));
  assert.deepEqual(remaining, [
    { group: "B0", modelTurns: 1, toolCalls: 1, wallClockMs: 181_915 },
    { group: "B1", modelTurns: 2, toolCalls: 2, wallClockMs: 202_813 },
  ]);
});

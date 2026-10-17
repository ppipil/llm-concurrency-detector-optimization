import assert from "node:assert/strict";
import test from "node:test";

import { createUsageTelemetry } from "./usage-telemetry.mjs";

test("usage telemetry accumulates provider fields and request count without double-counting reasoning", () => {
  const telemetry = createUsageTelemetry();
  telemetry.recordProviderResponse({
    stopReason: "toolUse",
    usage: { input: 10, output: 7, cacheRead: 20, cacheWrite: 3, reasoning: 4, totalTokens: 40 },
  });
  telemetry.recordProviderResponse({
    stopReason: "stop",
    usage: { input: 5, output: 2, cacheRead: 8, cacheWrite: 0, reasoning: 1, totalTokens: 15 },
  });

  const snapshot = telemetry.snapshot();
  assert.deepEqual(snapshot.totals, {
    providerTotal: 55,
    uncachedInput: 15,
    cacheRead: 28,
    cacheWrite: 3,
    output: 9,
    reasoning: 5,
    providerRequests: 2,
  });
  assert.equal(snapshot.totals.providerTotal, 15 + 28 + 3 + 9);
  assert.equal(snapshot.requests[1].cumulativeProviderTotal, 55);
});

test("provider total falls back to the four non-overlapping usage components", () => {
  const telemetry = createUsageTelemetry();
  telemetry.recordProviderResponse({ usage: { input: 4, output: 3, cacheRead: 2, cacheWrite: 1, reasoning: 2 } });
  assert.equal(telemetry.snapshot().totals.providerTotal, 10);
});

import assert from "node:assert/strict";
import test from "node:test";

import { createContextCapacitySnapshot, DEFAULT_CONTEXT_RESERVE_TOKENS } from "./context-capacity.mjs";

test("context capacity guard computes the fixed monitor-only threshold", () => {
  const snapshot = createContextCapacitySnapshot({
    contextUsage: { tokens: 14_713, contextWindow: 128_000 },
  });
  assert.equal(DEFAULT_CONTEXT_RESERVE_TOKENS, 16_384);
  assert.deepEqual(snapshot, {
    contextWindow: 128_000,
    currentTokens: 14_713,
    reserveTokens: 16_384,
    thresholdTokens: 111_616,
    utilization: 14_713 / 128_000,
    thresholdExceeded: false,
    action: "monitor_only",
    compactionEnabled: false,
  });
});

test("unknown current usage remains monitor-only rather than fabricating a value", () => {
  const snapshot = createContextCapacitySnapshot({ contextUsage: undefined, contextWindow: 128_000 });
  assert.equal(snapshot.currentTokens, null);
  assert.equal(snapshot.utilization, null);
  assert.equal(snapshot.thresholdExceeded, null);
});

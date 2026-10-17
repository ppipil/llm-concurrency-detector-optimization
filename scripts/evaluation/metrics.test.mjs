import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyOutcome,
  derivePreliminaryNoiseRule,
  extractBaselineStatistics,
  parseSympyTestSummary,
  summarizeSamples,
} from "./metrics.mjs";

test("summarizeSamples reports sample statistics", () => {
  const result = summarizeSamples([1, 2, 3]);
  assert.equal(result.mean_seconds, 2);
  assert.equal(result.median_seconds, 2);
  assert.equal(result.standard_deviation_seconds, 1);
  assert.equal(result.coefficient_of_variation_percent, 50);
});

test("preliminary rule uses twice the M2 CV when it exceeds ten percent", () => {
  const rule = derivePreliminaryNoiseRule(5.138592475870692);
  assert.equal(rule.status, "PROVISIONAL_NOT_FROZEN");
  assert.ok(Math.abs(rule.threshold_percent - 10.277184951741384) < 1e-12);
});

test("preliminary rule keeps a ten-percent floor for quieter baselines", () => {
  const rule = derivePreliminaryNoiseRule(3);
  assert.equal(rule.threshold_percent, 10);
  assert.equal(rule.success_speedup_boundary, 1.1);
  assert.equal(rule.performance_regression_speedup_boundary, 0.9);
});

test("correctness failure always has outcome REGRESSION", () => {
  const noiseRule = derivePreliminaryNoiseRule(5);
  assert.equal(classifyOutcome({ correctnessStatus: "FAIL", speedup: 100, noiseRule }), "REGRESSION");
});

test("comparison outcomes cover success, no gain, and performance regression", () => {
  const noiseRule = derivePreliminaryNoiseRule(5);
  assert.equal(classifyOutcome({ correctnessStatus: "PASS", speedup: 1.2, noiseRule }), "SUCCESS");
  assert.equal(classifyOutcome({ correctnessStatus: "PASS", speedup: 1.05, noiseRule }), "NO_GAIN");
  assert.equal(
    classifyOutcome({ correctnessStatus: "PASS", speedup: 0.8, noiseRule }),
    "PERFORMANCE_REGRESSION",
  );
});

test("comparison boundaries are inclusive", () => {
  const noiseRule = derivePreliminaryNoiseRule(3);
  assert.equal(
    classifyOutcome({ correctnessStatus: "PASS", speedup: 1.1, noiseRule }),
    "SUCCESS",
  );
  assert.equal(
    classifyOutcome({ correctnessStatus: "PASS", speedup: 0.9, noiseRule }),
    "PERFORMANCE_REGRESSION",
  );
});

test("a correctness-passing baseline without comparison has no optimization outcome", () => {
  assert.equal(
    classifyOutcome({ correctnessStatus: "PASS", speedup: null, noiseRule: null }),
    null,
  );
});

test("SymPy summary parser preserves expected failures", () => {
  assert.deepEqual(
    parseSympyTestSummary("= tests finished: 288 passed, 7 skipped, 8 expected to fail, in 39.22 seconds =="),
    {
      parsed: true,
      passed: 288,
      skipped: 7,
      expected_failures: 8,
      exceptions: 0,
      reported_duration_seconds: 39.22,
    },
  );
});

test("M2 baseline schema is accepted", () => {
  assert.deepEqual(
    extractBaselineStatistics({
      correctness: { exitCode: 0 },
      benchmark: {
        allSamplesSummary: { meanSeconds: 4.8, coefficientOfVariationPercent: 5.1 },
      },
    }),
    {
      schema: "m2-reproduction-v1",
      mean_seconds: 4.8,
      coefficient_of_variation_percent: 5.1,
      correctness_status: "PASS",
    },
  );
});

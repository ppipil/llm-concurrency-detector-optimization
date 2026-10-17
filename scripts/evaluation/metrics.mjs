export function summarizeSamples(samples) {
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new Error("At least one runtime sample is required.");
  }
  if (samples.some((sample) => !Number.isFinite(sample) || sample <= 0)) {
    throw new Error("Runtime samples must be finite positive numbers.");
  }

  const sorted = [...samples].sort((left, right) => left - right);
  const mean = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
  const variance =
    samples.length > 1
      ? samples.reduce((sum, sample) => sum + (sample - mean) ** 2, 0) / (samples.length - 1)
      : 0;
  const standardDeviation = Math.sqrt(variance);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;

  return {
    count: samples.length,
    mean_seconds: mean,
    median_seconds: median,
    standard_deviation_seconds: standardDeviation,
    coefficient_of_variation_percent: (standardDeviation / mean) * 100,
    minimum_seconds: sorted[0],
    maximum_seconds: sorted.at(-1),
  };
}

export function derivePreliminaryNoiseRule(baselineCvPercent) {
  if (!Number.isFinite(baselineCvPercent) || baselineCvPercent < 0) {
    throw new Error("Baseline CV must be a finite non-negative percentage.");
  }
  const minimumThresholdFraction = 0.1;
  const cvMultiplier = 2;
  const thresholdFraction = Math.max(minimumThresholdFraction, (cvMultiplier * baselineCvPercent) / 100);
  return {
    status: "PROVISIONAL_NOT_FROZEN",
    basis: "max(10%, 2 * baseline all-sample CV)",
    baseline_cv_percent: baselineCvPercent,
    cv_multiplier: cvMultiplier,
    minimum_threshold_percent: minimumThresholdFraction * 100,
    threshold_fraction: thresholdFraction,
    threshold_percent: thresholdFraction * 100,
    success_speedup_boundary: 1 + thresholdFraction,
    performance_regression_speedup_boundary: 1 - thresholdFraction,
  };
}

export function classifyOutcome({ correctnessStatus, speedup, noiseRule }) {
  if (correctnessStatus !== "PASS") return "REGRESSION";
  if (speedup === null || speedup === undefined) return null;
  if (!Number.isFinite(speedup) || speedup <= 0) {
    throw new Error("Speedup must be a finite positive number when supplied.");
  }
  if (!noiseRule || !Number.isFinite(noiseRule.threshold_fraction)) {
    throw new Error("A valid noise rule is required when classifying a comparison.");
  }

  if (speedup >= noiseRule.success_speedup_boundary) return "SUCCESS";
  if (speedup <= noiseRule.performance_regression_speedup_boundary) return "PERFORMANCE_REGRESSION";
  return "NO_GAIN";
}

export function parseSympyTestSummary(output) {
  const match = output.match(
    /tests finished:\s*(\d+) passed(?:,\s*(\d+) skipped)?(?:,\s*(\d+) expected to fail)?(?:,\s*(\d+) exceptions)?(?:,\s*in\s*([\d.]+) seconds)?/iu,
  );
  if (!match) {
    return { parsed: false, raw_summary_line: output.split(/\r?\n/u).find((line) => line.includes("tests finished")) ?? null };
  }
  return {
    parsed: true,
    passed: Number(match[1]),
    skipped: Number(match[2] ?? 0),
    expected_failures: Number(match[3] ?? 0),
    exceptions: Number(match[4] ?? 0),
    reported_duration_seconds: match[5] === undefined ? null : Number(match[5]),
  };
}

export function extractBaselineStatistics(document) {
  if (document?.performance?.statistics?.mean_seconds !== undefined) {
    return {
      schema: "evaluation-harness-v1",
      mean_seconds: document.performance.statistics.mean_seconds,
      coefficient_of_variation_percent: document.performance.statistics.coefficient_of_variation_percent,
      correctness_status: document.correctness?.status,
    };
  }
  if (document?.benchmark?.allSamplesSummary?.meanSeconds !== undefined) {
    return {
      schema: "m2-reproduction-v1",
      mean_seconds: document.benchmark.allSamplesSummary.meanSeconds,
      coefficient_of_variation_percent: document.benchmark.allSamplesSummary.coefficientOfVariationPercent,
      correctness_status: document.correctness?.exitCode === 0 ? "PASS" : "FAIL",
    };
  }
  throw new Error("Unsupported baseline JSON schema or missing baseline statistics.");
}

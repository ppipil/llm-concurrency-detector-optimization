function nonNegative(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function normalizedUsage(message) {
  const usage = message?.usage ?? {};
  const uncachedInput = nonNegative(usage.input);
  const output = nonNegative(usage.output);
  const cacheRead = nonNegative(usage.cacheRead);
  const cacheWrite = nonNegative(usage.cacheWrite);
  const reasoning = nonNegative(usage.reasoning);
  const componentTotal = uncachedInput + output + cacheRead + cacheWrite;
  const providerTotal = nonNegative(usage.totalTokens) || componentTotal;
  return { providerTotal, uncachedInput, cacheRead, cacheWrite, output, reasoning };
}

export function createUsageTelemetry() {
  const totals = {
    providerTotal: 0,
    uncachedInput: 0,
    cacheRead: 0,
    cacheWrite: 0,
    output: 0,
    reasoning: 0,
    providerRequests: 0,
  };
  const requests = [];

  const recordProviderResponse = (message) => {
    const usage = normalizedUsage(message);
    totals.providerRequests += 1;
    for (const field of ["providerTotal", "uncachedInput", "cacheRead", "cacheWrite", "output", "reasoning"]) {
      totals[field] += usage[field];
    }
    requests.push(Object.freeze({
      request: totals.providerRequests,
      stopReason: message?.stopReason ?? null,
      ...usage,
      cumulativeProviderTotal: totals.providerTotal,
    }));
    return requests.at(-1);
  };

  return {
    recordProviderResponse,
    snapshot() {
      return Object.freeze({
        totals: Object.freeze({ ...totals }),
        requests: Object.freeze(requests.map((request) => Object.freeze({ ...request }))),
      });
    },
  };
}

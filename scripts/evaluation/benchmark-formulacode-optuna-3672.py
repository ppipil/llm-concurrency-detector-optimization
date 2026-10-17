import argparse
import json
import statistics
import time

import optuna

from benchmarks.asv.optimize import OptimizeSuite


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--samples", type=int, default=3)
    args = parser.parse_args()

    optuna.logging.set_verbosity(optuna.logging.WARNING)
    samples = []
    for _ in range(args.samples):
        started = time.perf_counter()
        OptimizeSuite().optimize("redis", "random", 1000)
        samples.append(time.perf_counter() - started)

    payload = {
        "workload": "benchmarks.asv.optimize.OptimizeSuite.optimize(redis, random, 1000)",
        "samples_seconds": samples,
        "mean_seconds": statistics.fmean(samples),
        "median_seconds": statistics.median(samples),
    }
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()

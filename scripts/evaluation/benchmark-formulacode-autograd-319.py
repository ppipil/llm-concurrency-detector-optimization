import argparse
import json
import os
import statistics
import sys
import time

sys.path.insert(0, os.getcwd())

from benchmarks.bench_rnn import RNNSuite


def measure() -> float:
    suite = RNNSuite()
    suite.setup()
    started = time.perf_counter()
    suite.time_rnn_grad()
    return time.perf_counter() - started


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--samples", type=int, default=7)
    parser.add_argument("--warmups", type=int, default=1)
    args = parser.parse_args()

    for _ in range(args.warmups):
        measure()
    samples = [measure() for _ in range(args.samples)]
    payload = {
        "workload": "benchmarks.bench_rnn.RNNSuite.time_rnn_grad",
        "warmups": args.warmups,
        "samples_seconds": samples,
        "mean_seconds": statistics.fmean(samples),
        "median_seconds": statistics.median(samples),
        "std_seconds": statistics.stdev(samples) if len(samples) > 1 else 0.0,
    }
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()

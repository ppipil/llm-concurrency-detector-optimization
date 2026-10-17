"""Run the fixed M5d workload for a small number of unprofiled samples."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import runpy
import statistics
import timeit


ROOT = Path(__file__).resolve().parents[2]
WORKLOAD = ROOT / "experiments" / "tasks" / "sympy__sympy-21391" / "evaluator" / "workload_sanity.py"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--samples", type=int, default=5, choices=range(3, 6))
    args = parser.parse_args()
    namespace = runpy.run_path(str(WORKLOAD))
    samples = timeit.repeat(namespace["workload"], number=1, repeat=args.samples)
    print(json.dumps({
        "samples": samples,
        "mean_seconds": statistics.mean(samples),
        "median_seconds": statistics.median(samples),
        "sample_standard_deviation_seconds": statistics.stdev(samples),
        "samples_count": len(samples),
        "profiling_enabled": False,
        "purpose": "development sanity check only",
    }))


if __name__ == "__main__":
    main()

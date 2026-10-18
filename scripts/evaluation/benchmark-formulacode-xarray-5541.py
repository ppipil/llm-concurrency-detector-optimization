"""Unprofiled primary and auxiliary benchmarks for pydata_xarray_5541."""

from __future__ import annotations

import argparse
import gc
import json
import os
from pathlib import Path
import statistics
import sys
import time
from typing import Callable


sys.path.insert(0, os.getcwd())

import numpy as np

from xarray import Variable


PRIMARY_ITERATIONS = 100_000


def summarize(samples: list[float]) -> dict[str, float | list[float]]:
    mean = statistics.fmean(samples)
    standard_deviation = statistics.stdev(samples) if len(samples) > 1 else 0.0
    return {
        "samples_seconds": samples,
        "mean_seconds": mean,
        "median_seconds": statistics.median(samples),
        "std_seconds": standard_deviation,
        "cv": standard_deviation / mean if mean else 0.0,
        "minimum_seconds": min(samples),
        "maximum_seconds": max(samples),
    }


def time_without_gc(action: Callable[[], None]) -> float:
    was_enabled = gc.isenabled()
    gc.disable()
    try:
        started = time.perf_counter()
        action()
        return time.perf_counter() - started
    finally:
        if was_enabled:
            gc.enable()


def create_primary_action(iterations: int = PRIMARY_ITERATIONS) -> Callable[[], None]:
    variable = Variable(("x",), np.arange(1000.0))

    def action() -> None:
        for _ in range(iterations):
            variable.transpose()

    return action


def profile_primary(iterations: int = PRIMARY_ITERATIONS) -> None:
    """Run the exact primary operation under a profiler, never as benchmark time."""
    create_primary_action(iterations)()


def create_auxiliary_action() -> Callable[[], None]:
    from asv_bench.benchmarks.interp import Interpolation

    benchmark = Interpolation()
    benchmark.setup()

    def action() -> None:
        benchmark.time_interpolation("linear", True)

    return action


def run_samples(action: Callable[[], None], warmups: int, sample_count: int) -> list[float]:
    for _ in range(warmups):
        time_without_gc(action)
    return [time_without_gc(action) for _ in range(sample_count)]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--warmups", type=int, default=1)
    parser.add_argument("--primary-samples", type=int, default=15)
    parser.add_argument("--primary-iterations", type=int, default=PRIMARY_ITERATIONS)
    parser.add_argument("--auxiliary-samples", type=int, default=7)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if min(args.warmups, args.primary_samples, args.primary_iterations, args.auxiliary_samples) < 1:
        parser.error("warmups, samples, and iterations must be positive")

    primary = run_samples(
        create_primary_action(args.primary_iterations),
        args.warmups,
        args.primary_samples,
    )
    auxiliary = run_samples(
        create_auxiliary_action(),
        args.warmups,
        args.auxiliary_samples,
    )
    payload = {
        "schema_version": 1,
        "measurement_kind": "unprofiled_benchmark",
        "primary": {
            "workload": "xarray.Variable(('x',), arange(1000.0)).transpose()",
            "iterations_per_sample": args.primary_iterations,
            "warmups": args.warmups,
            **summarize(primary),
        },
        "auxiliary": {
            "workload": "asv_bench.benchmarks.interp.Interpolation.time_interpolation(linear, short)",
            "warmups": args.warmups,
            **summarize(auxiliary),
        },
    }
    rendered = json.dumps(payload, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)


if __name__ == "__main__":
    main()

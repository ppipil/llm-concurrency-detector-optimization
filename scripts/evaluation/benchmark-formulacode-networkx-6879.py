"""Unprofiled fixed rescale_layout benchmark for networkx_networkx_6879."""

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

from networkx.drawing.layout import rescale_layout


PRIMARY_ITERATIONS = 100
PRIMARY_POINTS = 100_000
PRIMARY_DIMENSIONS = 3


def summarize(samples: list[float]) -> dict[str, float | list[float]]:
    mean = statistics.fmean(samples)
    deviation = statistics.stdev(samples) if len(samples) > 1 else 0.0
    return {
        "samples_seconds": samples,
        "mean_seconds": mean,
        "median_seconds": statistics.median(samples),
        "std_seconds": deviation,
        "cv": deviation / mean if mean else 0.0,
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


def create_primary_action(
    iterations: int = PRIMARY_ITERATIONS,
    points: int = PRIMARY_POINTS,
    dimensions: int = PRIMARY_DIMENSIONS,
) -> Callable[[], None]:
    random = np.random.default_rng(6879)
    position = random.normal(size=(points, dimensions))

    def action() -> None:
        for _ in range(iterations):
            rescale_layout(position, scale=1.0)

    return action


def profile_primary(
    iterations: int = PRIMARY_ITERATIONS,
    points: int = PRIMARY_POINTS,
    dimensions: int = PRIMARY_DIMENSIONS,
) -> None:
    """Run the exact primary operation under a profiler, never as benchmark time."""
    create_primary_action(iterations, points, dimensions)()


def run_samples(action: Callable[[], None], warmups: int, sample_count: int) -> list[float]:
    for _ in range(warmups):
        time_without_gc(action)
    return [time_without_gc(action) for _ in range(sample_count)]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--warmups", type=int, default=1)
    parser.add_argument("--samples", type=int, default=15)
    parser.add_argument("--iterations", type=int, default=PRIMARY_ITERATIONS)
    parser.add_argument("--points", type=int, default=PRIMARY_POINTS)
    parser.add_argument("--dimensions", type=int, default=PRIMARY_DIMENSIONS)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if min(args.warmups, args.samples, args.iterations, args.points, args.dimensions) < 1:
        parser.error("warmups, samples, iterations, points, and dimensions must be positive")

    samples = run_samples(
        create_primary_action(args.iterations, args.points, args.dimensions),
        args.warmups,
        args.samples,
    )
    payload = {
        "schema_version": 1,
        "measurement_kind": "unprofiled_benchmark",
        "primary": {
            "workload": "networkx.rescale_layout on deterministic dense NumPy coordinates",
            "iterations_per_sample": args.iterations,
            "points": args.points,
            "dimensions": args.dimensions,
            "warmups": args.warmups,
            **summarize(samples),
        },
    }
    rendered = json.dumps(payload, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)


if __name__ == "__main__":
    main()

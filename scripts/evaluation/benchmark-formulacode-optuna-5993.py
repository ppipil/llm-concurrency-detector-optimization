"""Unprofiled fixed waiting-trial benchmark for optuna_optuna_5993."""

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

import optuna
from optuna.trial import TrialState


PRIMARY_ITERATIONS = 500
NON_WAITING_TRIALS = 10_000


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
    non_waiting_trials: int = NON_WAITING_TRIALS,
) -> Callable[[], None]:
    storage = optuna.storages.InMemoryStorage()
    study = optuna.create_study(storage=storage, study_name="fixed-waiting-trial-benchmark")
    for _ in range(non_waiting_trials):
        storage.create_new_trial(study._study_id)
    waiting_trial_id = storage.create_new_trial(study._study_id)
    storage.set_trial_state_values(waiting_trial_id, TrialState.WAITING)

    def action() -> None:
        for _ in range(iterations):
            popped = study._pop_waiting_trial_id()
            if popped != waiting_trial_id:
                raise RuntimeError(f"Unexpected waiting trial: {popped}")
            if not storage.set_trial_state_values(waiting_trial_id, TrialState.WAITING):
                raise RuntimeError("Unable to reset waiting trial")

    return action


def profile_primary(
    iterations: int = PRIMARY_ITERATIONS,
    non_waiting_trials: int = NON_WAITING_TRIALS,
) -> None:
    """Run the exact primary operation under a profiler, never as benchmark time."""
    create_primary_action(iterations, non_waiting_trials)()


def run_samples(action: Callable[[], None], warmups: int, sample_count: int) -> list[float]:
    for _ in range(warmups):
        time_without_gc(action)
    return [time_without_gc(action) for _ in range(sample_count)]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--warmups", type=int, default=5)
    parser.add_argument("--samples", type=int, default=15)
    parser.add_argument("--iterations", type=int, default=PRIMARY_ITERATIONS)
    parser.add_argument("--non-waiting-trials", type=int, default=NON_WAITING_TRIALS)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if min(args.warmups, args.samples, args.iterations, args.non_waiting_trials) < 1:
        parser.error("warmups, samples, iterations, and non-waiting-trials must be positive")

    samples = run_samples(
        create_primary_action(args.iterations, args.non_waiting_trials),
        args.warmups,
        args.samples,
    )
    payload = {
        "schema_version": 1,
        "measurement_kind": "unprofiled_benchmark",
        "primary": {
            "workload": "InMemoryStorage: pop one waiting trial after a 10000-trial non-waiting prefix and reset it to WAITING",
            "iterations_per_sample": args.iterations,
            "non_waiting_trials": args.non_waiting_trials,
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

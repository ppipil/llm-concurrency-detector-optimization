"""Run the frozen correctness and benchmark evaluator for optuna_optuna_5993."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import subprocess
import sys
import time
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
TASK_ID = "optuna_optuna_5993"
TASK_DIR = ROOT / "experiments" / "tasks" / "formulacode-optuna-5993"
MANIFEST_PATH = TASK_DIR / "evaluator" / "manifest.json"
BENCHMARK_PATH = ROOT / "scripts" / "evaluation" / "benchmark-formulacode-optuna-5993.py"
CONTRACT_TEST_PATH = TASK_DIR / "evaluator" / "test_optuna_5993_contract.py"
DEFAULT_WORKSPACE = ROOT / "workspaces" / "m6-optuna-5993-precheck"
MEANINGFUL_GAIN = 0.10


def execute(command: list[str], cwd: Path, environment: dict[str, str]) -> dict[str, Any]:
    started = time.perf_counter()
    completed = subprocess.run(command, cwd=cwd, env=environment, check=False, capture_output=True, text=True, shell=False)
    return {
        "command": subprocess.list2cmdline(command),
        "exit_code": completed.returncode,
        "wall_time_seconds": time.perf_counter() - started,
        "stdout": completed.stdout,
        "stderr": completed.stderr,
    }


def git(workspace: Path, *arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git.exe", *arguments], cwd=workspace, check=False, capture_output=True, text=True, shell=False)


def parse_test_summary(output: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for name in ("passed", "failed", "skipped", "xfailed", "xpassed", "warnings"):
        match = re.search(rf"(\d+)\s+{name}", output)
        counts[name] = int(match.group(1)) if match else 0
    return counts


def classify(correctness_passed: bool, speedup: float | None) -> str | None:
    if not correctness_passed:
        return "REGRESSION"
    if speedup is None:
        return None
    if speedup >= 1.0 + MEANINGFUL_GAIN:
        return "SUCCESS"
    if speedup <= 1.0 / (1.0 + MEANINGFUL_GAIN):
        return "PERFORMANCE_REGRESSION"
    return "NO_GAIN"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", type=Path, default=DEFAULT_WORKSPACE)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--baseline", type=Path)
    args = parser.parse_args()
    if sys.platform != "win32":
        raise RuntimeError("Native Windows only")

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    workspace = args.workspace.resolve()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    python = workspace / ".venv" / "Scripts" / "python.exe"
    if not python.is_file():
        raise RuntimeError(f"Missing workspace Python environment: {python}")

    revision = git(workspace, "rev-parse", "HEAD").stdout.strip()
    if revision != manifest["base_commit"]:
        raise RuntimeError(f"Unexpected target revision: {revision or 'unknown'}")
    diff = git(workspace, "diff", "--binary", "--no-ext-diff")
    if diff.returncode != 0:
        raise RuntimeError("Unable to capture source patch")

    environment = os.environ.copy()
    environment["PYTHONPATH"] = str(workspace)
    correctness_targets = [*manifest["correctness"]["repository_tests"], str(CONTRACT_TEST_PATH)]
    correctness = execute(
        [str(python), "-m", "pytest", *correctness_targets, "-q", "--disable-warnings", "--rootdir", str(workspace)],
        workspace,
        environment,
    )
    (output / "correctness.stdout.txt").write_text(correctness["stdout"], encoding="utf-8")
    (output / "correctness.stderr.txt").write_text(correctness["stderr"], encoding="utf-8")
    correctness["summary"] = parse_test_summary(f"{correctness['stdout']}\n{correctness['stderr']}")
    correctness["status"] = "PASS" if correctness["exit_code"] == 0 else "FAIL"

    config = manifest["benchmark"]
    benchmark_run = execute(
        [
            str(python), str(BENCHMARK_PATH),
            "--warmups", str(config["warmups"]),
            "--samples", str(config["primary_samples"]),
            "--iterations", str(config["primary_iterations_per_sample"]),
            "--non-waiting-trials", str(config["non_waiting_trials"]),
            "--output", str(output / "benchmark.json"),
        ],
        workspace,
        environment,
    )
    (output / "benchmark.stdout.txt").write_text(benchmark_run["stdout"], encoding="utf-8")
    (output / "benchmark.stderr.txt").write_text(benchmark_run["stderr"], encoding="utf-8")
    benchmark = json.loads((output / "benchmark.json").read_text(encoding="utf-8")) if benchmark_run["exit_code"] == 0 else None

    baseline_mean = None
    speedup = None
    if args.baseline:
        baseline_document = json.loads(args.baseline.resolve().read_text(encoding="utf-8"))
        baseline_mean = baseline_document["benchmark"]["primary"]["mean_seconds"]
        if benchmark:
            speedup = baseline_mean / benchmark["primary"]["mean_seconds"]
    outcome = classify(correctness["exit_code"] == 0, speedup)
    result = {
        "schema_version": 1,
        "task": {
            "instance_id": TASK_ID,
            "repository": manifest["repository"],
            "revision": revision,
            "patch_sha256": hashlib.sha256(diff.stdout.encode("utf-8")).hexdigest(),
            "source_patch_present": bool(diff.stdout),
        },
        "environment": {"platform": platform.platform(), "python": platform.python_version(), "python_executable": str(python)},
        "correctness": correctness,
        "benchmark_run": benchmark_run,
        "benchmark": benchmark,
        "comparison": {
            "baseline_mean_seconds": baseline_mean,
            "optimized_mean_seconds": benchmark["primary"]["mean_seconds"] if benchmark else None,
            "speedup": speedup,
            "meaningful_gain_threshold": MEANINGFUL_GAIN,
            "outcome": outcome,
        },
        "status": "PASS" if correctness["exit_code"] == 0 and benchmark_run["exit_code"] == 0 else "FAIL",
    }
    (output / "evaluation.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (output / "summary.md").write_text(
        f"# optuna_optuna_5993 evaluation\n\n"
        f"- Revision: `{revision}`\n"
        f"- Source patch present: `{bool(diff.stdout)}`\n"
        f"- Correctness: `{correctness['status']}` ({correctness['summary'].get('passed', 0)} passed)\n"
        f"- Primary mean: `{benchmark['primary']['mean_seconds'] if benchmark else None}` seconds\n"
        f"- Primary CV: `{benchmark['primary']['cv'] if benchmark else None}`\n"
        f"- Speedup: `{speedup}`\n"
        f"- Outcome: `{outcome}`\n",
        encoding="utf-8",
    )
    print(json.dumps({"status": result["status"], "output": str(output)}, indent=2))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())

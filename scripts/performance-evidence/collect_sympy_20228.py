"""Collect cProfile evidence for the unchanged sympy__sympy-20228 workload."""

from __future__ import annotations

import argparse
import contextlib
import cProfile
import hashlib
import io
import json
import os
from pathlib import Path
import platform
import pstats
import runpy
import subprocess
import sys
import sysconfig
import time
from datetime import datetime, timezone
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
TASK_ID = "sympy__sympy-20228"
TASK_DIR = ROOT / "experiments" / "tasks" / TASK_ID
MANIFEST_PATH = TASK_DIR / "evaluator" / "manifest.json"
WORKLOAD_PATH = TASK_DIR / "evaluator" / "workload_windows.py"
DEFAULT_WORKSPACE = ROOT / "workspaces" / "m2-sympy-20228"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", type=Path, default=DEFAULT_WORKSPACE)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--top", type=int, default=20)
    parser.add_argument("--task-id", default=TASK_ID)
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--workload", type=Path)
    parser.add_argument("--callable", dest="callable_name")
    args = parser.parse_args()
    if args.top < 1:
        parser.error("--top must be a positive integer")
    return args


def run(command: list[str], cwd: Path) -> dict[str, Any]:
    started = time.perf_counter()
    completed = subprocess.run(
        command,
        cwd=cwd,
        check=False,
        capture_output=True,
        text=True,
        shell=False,
    )
    return {
        "command": subprocess.list2cmdline(command),
        "exit_code": completed.returncode,
        "wall_time_ms": round((time.perf_counter() - started) * 1000),
        "stdout": completed.stdout,
        "stderr": completed.stderr,
    }


def is_relative_to(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def classify_source(filename: str, workspace: Path) -> tuple[str, bool, str]:
    if filename.startswith("{") or filename.startswith("~") or filename.startswith("<"):
        return "built_in", False, filename

    source = Path(filename).resolve()
    venv = (workspace / ".venv").resolve()
    if is_relative_to(source, venv):
        return "external_dependency", False, source.as_posix()
    if is_relative_to(source, workspace.resolve()):
        return "repository", True, source.relative_to(workspace.resolve()).as_posix()
    if is_relative_to(source, ROOT.resolve()):
        return "evaluator", False, source.relative_to(ROOT.resolve()).as_posix()

    stdlib = Path(sysconfig.get_path("stdlib")).resolve()
    if is_relative_to(source, stdlib):
        return "standard_library", False, source.as_posix()
    return "external_dependency", False, source.as_posix()


def unpack_caller(value: Any) -> tuple[int | None, int | None, float | None, float | None]:
    if isinstance(value, tuple) and len(value) == 4:
        primitive_calls, total_calls, self_time, cumulative_time = value
        return int(primitive_calls), int(total_calls), float(self_time), float(cumulative_time)
    if isinstance(value, (int, float)):
        return None, int(value), None, None
    return None, None, None, None


def symbol_id(key: tuple[str, int, str]) -> str:
    filename, line, function = key
    return f"{Path(filename).as_posix()}:{line}:{function}"


def normalize_profile(profile_path: Path, workspace: Path) -> dict[str, Any]:
    stats = pstats.Stats(str(profile_path))
    total_self_time = float(stats.total_tt)
    functions: list[dict[str, Any]] = []
    relationships: list[dict[str, Any]] = []

    for key, raw in stats.stats.items():
        filename, line, function = key
        primitive_calls, total_calls, self_time, cumulative_time, callers = raw
        ownership, repository_owned, source_file = classify_source(filename, workspace)
        record = {
            "id": symbol_id(key),
            "function": function,
            "source_file": source_file,
            "source_line": line if line > 0 else None,
            "primitive_call_count": primitive_calls,
            "total_call_count": total_calls,
            "self_time_seconds": self_time,
            "cumulative_time_seconds": cumulative_time,
            "runtime_share_percent": (self_time / total_self_time * 100) if total_self_time else 0.0,
            "cumulative_share_percent": (
                cumulative_time / total_self_time * 100 if total_self_time else 0.0
            ),
            "ownership": ownership,
            "repository_owned": repository_owned,
        }
        functions.append(record)

        for caller_key, caller_value in callers.items():
            edge_primitive, edge_total, edge_self, edge_cumulative = unpack_caller(caller_value)
            relationships.append(
                {
                    "caller_id": symbol_id(caller_key),
                    "callee_id": symbol_id(key),
                    "primitive_call_count": edge_primitive,
                    "total_call_count": edge_total,
                    "self_time_seconds": edge_self,
                    "cumulative_time_seconds": edge_cumulative,
                }
            )

    functions.sort(key=lambda item: item["self_time_seconds"], reverse=True)
    relationships.sort(
        key=lambda item: item["cumulative_time_seconds"] or 0.0,
        reverse=True,
    )
    return {
        "profiled_self_time_total_seconds": total_self_time,
        "function_count": len(functions),
        "relationship_count": len(relationships),
        "functions": functions,
        "call_relationships": relationships,
    }


def render_pstats(profile_path: Path, sort_key: pstats.SortKey, action: str) -> str:
    stream = io.StringIO()
    stats = pstats.Stats(str(profile_path), stream=stream).strip_dirs().sort_stats(sort_key)
    if action == "stats":
        stats.print_stats()
    elif action == "callers":
        stats.print_callers()
    elif action == "callees":
        stats.print_callees()
    else:
        raise ValueError(action)
    return stream.getvalue()


def render_summary(evidence: dict[str, Any], top: int) -> str:
    profile = evidence["profile"]
    functions = profile["functions"]
    repository = [item for item in functions if item["repository_owned"]]
    external = [item for item in functions if not item["repository_owned"]]
    by_id = {item["id"]: item for item in functions}

    def table(items: list[dict[str, Any]], sort_field: str) -> str:
        selected = sorted(items, key=lambda item: item[sort_field], reverse=True)[:top]
        rows = [
            "| Function | Source | Calls | Self (s) | Cumulative (s) | Self share | Ownership |",
            "|---|---|---:|---:|---:|---:|---|",
        ]
        for item in selected:
            location = item["source_file"]
            if item["source_line"] is not None:
                location += f":{item['source_line']}"
            rows.append(
                f"| `{item['function']}` | `{location}` | {item['total_call_count']} | "
                f"{item['self_time_seconds']:.6f} | {item['cumulative_time_seconds']:.6f} | "
                f"{item['runtime_share_percent']:.2f}% | `{item['ownership']}` |"
            )
        return "\n".join(rows)

    def relationship_table() -> str:
        selected = [
            edge
            for edge in profile["call_relationships"]
            if by_id.get(edge["caller_id"], {}).get("repository_owned")
            and by_id.get(edge["callee_id"], {}).get("repository_owned")
        ][:top]
        rows = [
            "| Caller | Callee | Calls | Edge cumulative (s) |",
            "|---|---|---:|---:|",
        ]
        for edge in selected:
            caller = by_id[edge["caller_id"]]
            callee = by_id[edge["callee_id"]]
            caller_label = f"{caller['function']} ({caller['source_file']}:{caller['source_line']})"
            callee_label = f"{callee['function']} ({callee['source_file']}:{callee['source_line']})"
            edge_time = edge["cumulative_time_seconds"]
            rows.append(
                f"| `{caller_label}` | `{callee_label}` | {edge['total_call_count']} | "
                f"{edge_time if edge_time is not None else 0.0:.6f} |"
            )
        return "\n".join(rows)

    return f"""# Performance Evidence Summary

- Task: `{evidence['task']['instance_id']}`
- Revision: `{evidence['task']['revision']}`
- Profiler: `{evidence['profiler']['name']}` ({evidence['profiler']['version']})
- Measurement purpose: **profiling only**
- Eligible for speedup calculation: **no**
- Profiler exit status: `{evidence['profiler_run']['status']}`
- Profiler wall time: {evidence['profiler_run']['wall_time_seconds']:.3f} s
- Total profiler self time: {profile['profiled_self_time_total_seconds']:.3f} s
- Functions: {profile['function_count']}
- Call relationships: {profile['relationship_count']}

## Top repository-owned functions by self time

{table(repository, 'self_time_seconds')}

## Top repository-owned functions by cumulative time

{table(repository, 'cumulative_time_seconds')}

## Top non-repository functions by self time

{table(external, 'self_time_seconds')}

## Top repository-owned caller-callee relationships

{relationship_table()}

## Interpretation boundary

`cProfile` is deterministic instrumentation. Its times include profiler overhead and must not be used as benchmark runtime or in speedup calculations. `source_line` is the function's definition/start line, not line-level timing. Runtime share is self time divided by total profiled self time; cumulative shares can overlap and therefore need not sum to 100%.
"""


def main() -> int:
    args = parse_args()
    if sys.platform != "win32":
        raise RuntimeError("M4 is Native Windows only")

    workspace = args.workspace.resolve()
    task_dir = ROOT / "experiments" / "tasks" / args.task_id
    manifest_path = (args.manifest or task_dir / "evaluator" / "manifest.json").resolve()
    workload_path = (args.workload or task_dir / "evaluator" / "workload_windows.py").resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S.%f")[:-3] + "Z"
    output = (
        args.output.resolve()
        if args.output
        else ROOT / "results" / "raw" / "profiles" / TASK_ID / run_id
    )
    output.mkdir(parents=True, exist_ok=False)

    revision_result = run(["git.exe", "rev-parse", "HEAD"], workspace)
    revision = revision_result["stdout"].strip()
    if revision_result["exit_code"] != 0 or revision != manifest["base_commit"]:
        raise RuntimeError(f"Unexpected target revision: {revision or 'unknown'}")

    status_before = run(["git.exe", "status", "--porcelain"], workspace)
    if status_before["exit_code"] != 0 or status_before["stdout"].strip():
        raise RuntimeError("M4 baseline workspace must be unchanged and clean")

    profile_path = output / "profile.prof"
    workload_stdout = output / "workload.stdout.txt"
    workload_stderr = output / "workload.stderr.txt"
    profiler = cProfile.Profile()
    started_at = datetime.now(timezone.utc)
    wall_started = time.perf_counter()
    original_cwd = Path.cwd()
    status = "PASS"
    error: str | None = None
    try:
        os.chdir(workspace)
        with workload_stdout.open("w", encoding="utf-8") as stdout_stream:
            with workload_stderr.open("w", encoding="utf-8") as stderr_stream:
                with contextlib.redirect_stdout(stdout_stream), contextlib.redirect_stderr(stderr_stream):
                    profiler.enable()
                    try:
                        if args.callable_name:
                            profiler.disable()
                            namespace = runpy.run_path(str(workload_path))
                            workload_callable = namespace.get(args.callable_name)
                            if not callable(workload_callable):
                                raise RuntimeError(f"Workload callable not found: {args.callable_name}")
                            profiler.enable()
                            workload_callable()
                        else:
                            runpy.run_path(str(workload_path), run_name="__main__")
                    finally:
                        profiler.disable()
    except Exception as exc:  # preserve partial capture and report the actual failure
        status = "FAIL"
        error = f"{type(exc).__name__}: {exc}"
    finally:
        os.chdir(original_cwd)
        profiler.dump_stats(str(profile_path))
    wall_time_seconds = time.perf_counter() - wall_started
    finished_at = datetime.now(timezone.utc)

    (output / "pstats-cumulative.txt").write_text(
        render_pstats(profile_path, pstats.SortKey.CUMULATIVE, "stats"), encoding="utf-8"
    )
    (output / "pstats-self-time.txt").write_text(
        render_pstats(profile_path, pstats.SortKey.TIME, "stats"), encoding="utf-8"
    )
    (output / "pstats-callers.txt").write_text(
        render_pstats(profile_path, pstats.SortKey.CUMULATIVE, "callers"), encoding="utf-8"
    )
    (output / "pstats-callees.txt").write_text(
        render_pstats(profile_path, pstats.SortKey.CUMULATIVE, "callees"), encoding="utf-8"
    )

    normalized = normalize_profile(profile_path, workspace)
    status_after = run(["git.exe", "status", "--porcelain"], workspace)
    unchanged_after = status_after["exit_code"] == 0 and not status_after["stdout"].strip()
    workload_sha256 = hashlib.sha256(workload_path.read_bytes()).hexdigest()
    evidence = {
        "schema_version": 1,
        "evidence_type": "runtime_profile",
        "run_id": run_id,
        "task": {
            "instance_id": args.task_id,
            "repository": manifest["repository"],
            "revision": revision,
            "workspace": str(workspace),
            "workspace_clean_before": True,
            "workspace_unchanged_after": unchanged_after,
        },
        "workload": {
            "path": str(workload_path),
            "sha256": workload_sha256,
            "benchmark_protocol_reference": str(manifest_path),
        },
        "profiler": {
            "name": "cProfile",
            "implementation": "CPython standard library deterministic profiler",
            "version": platform.python_version(),
            "clock": "platform-dependent high-resolution process/runtime clock used by cProfile",
            "source_line_semantics": "function definition/start line; not per-line timing",
        },
        "profiler_run": {
            "status": status,
            "error": error,
            "started_at": started_at.isoformat(),
            "finished_at": finished_at.isoformat(),
            "wall_time_seconds": wall_time_seconds,
            "command": subprocess.list2cmdline([sys.executable, *sys.argv]),
            "measurement_kind": "profiling",
            "benchmark_eligible": False,
            "profiler_overhead_included": True,
            "workload_stdout": str(workload_stdout),
            "workload_stderr": str(workload_stderr),
        },
        "environment": {
            "os": platform.platform(),
            "python_executable": sys.executable,
            "python_version": sys.version,
            "architecture": platform.architecture()[0],
        },
        "profile": normalized,
        "artifacts": {
            "raw_profile": str(profile_path),
            "raw_pstats_cumulative": str(output / "pstats-cumulative.txt"),
            "raw_pstats_self_time": str(output / "pstats-self-time.txt"),
            "raw_pstats_callers": str(output / "pstats-callers.txt"),
            "raw_pstats_callees": str(output / "pstats-callees.txt"),
            "normalized_json": str(output / "evidence.json"),
            "human_summary": str(output / "summary.md"),
        },
    }
    (output / "evidence.json").write_text(
        json.dumps(evidence, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    (output / "summary.md").write_text(render_summary(evidence, args.top), encoding="utf-8")

    print(
        json.dumps(
            {
                "status": status,
                "workspace_unchanged_after": unchanged_after,
                "function_count": normalized["function_count"],
                "relationship_count": normalized["relationship_count"],
                "output": str(output),
            },
            indent=2,
        )
    )
    return 0 if status == "PASS" and unchanged_after else 1


if __name__ == "__main__":
    raise SystemExit(main())

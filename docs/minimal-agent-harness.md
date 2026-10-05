# Minimal Performance Agent Harness

## Status and boundary

This is a design specification, not an optimization run. The current phase allows baseline preparation and tool validation only. The `edit` capability is therefore implemented in the interface design but must be disabled by policy until the user explicitly starts an optimization experiment.

The Harness is a Windows-native adapter around one immutable task manifest. It does not expose a general shell to the Agent.

## Goals

- Give every future Agent exactly the same five capabilities: `search`, `read`, `edit`, `run_test`, and `run_benchmark`.
- Prevent the Agent from changing the oracle, workload, Harness, environment, or evidence store.
- Keep task source, project-owned experiment definitions, and raw results separate.
- Make every action replayable and auditable.
- Support the three planned treatment groups without changing the underlying Agent or evaluator.

## Directory boundary

```text
workspaces/<instance-id>/        ignored third-party checkout; Agent-visible source root
experiments/tasks/<id>.json     versioned immutable task manifest
scripts/harness/                project-owned Harness implementation
results/raw/<run-id>/           ignored append-only raw stdout, stderr, timings, profiles
reports/                        versioned summaries derived from raw results
```

`detectors/` remains reserved for detector source. SWE-fficiency task repositories are not detectors and must not be mixed into it.

## Tool contracts

### `search`

Input: literal or regex query, allowlisted relative paths, file globs, and result limit.

Behavior: run a bounded repository search and return relative path, line number, and matching text. Reject paths outside the task source root. Hidden evaluator files, `.git`, raw results, expert patches, and task manifests are not searchable.

### `read`

Input: one relative file path and an optional line interval.

Behavior: return UTF-8 text with line numbers and a maximum byte/line limit. Reject binary files, symlink escapes, and evaluator-hidden paths.

### `edit`

Input: a unified patch whose paths are relative to the task source root.

Behavior: validate path containment, deny protected files and generated/binary files, apply atomically, and return the resulting diff summary. The tool records pre/post hashes. It cannot edit the workload, tests selected by the evaluator, task manifest, Harness, environment files, or raw evidence.

Current policy: `enabled: false`. Calls must return a structured `phase_forbids_edit` error and make no filesystem change.

### `run_test`

Input: an allowlisted test profile name such as `smoke`, `guarding`, or `full_guarding`; optional timeout no greater than the manifest ceiling.

Behavior: resolve the complete argv array from the immutable manifest, run it without shell interpolation, and return exit code, duration, pass/fail summary, and artifact references. The Agent cannot supply a raw command or weaken the selected tests.

### `run_benchmark`

Input: an allowlisted benchmark profile and requested repetition count within manifest limits.

Behavior: execute the evaluator-owned workload in fresh processes, outside profiler mode, and return raw samples plus summary statistics. It records warm-up policy, timeout, CPU/environment settings, source diff hash, and workload hash. The Agent cannot replace the workload or parse only favorable samples.

## Task manifest minimum

```json
{
  "schema_version": 1,
  "instance_id": "sympy__sympy-20228",
  "repository": "sympy/sympy",
  "base_commit": "c237fe7f4c1a4abcfaef0e79600e26cba4ac0a6d",
  "python": {"version": "TBD after build pilot"},
  "protected_paths": [".harness/**", ".oracle/**"],
  "test_profiles": {
    "guarding": {"argv": ["<pinned-python>", "<Windows test adapter>"], "timeout_seconds": 1800}
  },
  "benchmark_profiles": {
    "baseline": {"argv": ["<pinned-python>", "<evaluator-owned-workload>"], "timeout_seconds": 120}
  },
  "edit_policy": {"enabled": false}
}
```

Commands remain `TBD` until the exact checkout and environment have run successfully. Placeholder commands must never be reported as executed.

## Execution state machine

```text
PREPARED
  -> BASELINE_TEST_PASSED
  -> BASELINE_BENCHMARK_STABLE
  -> PROFILE_CAPTURED
  -> ELIGIBLE_FOR_FUTURE_AGENT_RUN

Any failed oracle, dirty protected path, command mismatch, timeout,
or missing artifact -> INVALID / investigate; never auto-waive.
```

During the current phase, the final state is `PROFILE_CAPTURED` or earlier. No transition to editing is authorized.

## Isolation and anti-cheating rules

- The Agent sees no expert patch, gold-touched file list, gold speedup, or post-edit results.
- The evaluator owns workload and oracle files outside the editable checkout.
- Network access is disabled during an Agent run after environment preparation.
- Only argv arrays from manifests are executed; no `cmd /c`, PowerShell expression evaluation, pipes, redirects, or arbitrary environment mutation are accepted from the Agent.
- Each tool call records a monotonically increasing action number, timestamp, arguments, result status, duration, and source-tree diff hash.
- Run limits include wall-clock, action count, test count, benchmark count, edit count, and output bytes.
- Before every test/benchmark, the Harness checks protected-file hashes. After every run, it records `git status --porcelain` and the full patch.
- Test and benchmark subprocess trees are terminated on timeout using Windows process controls.

## Treatment-group compatibility

All groups use the same five tools and task manifests. Group differences are limited to information supplied before the run:

- A: repository/task information only;
- B: the same information plus profiler evidence;
- C: the same profiler evidence plus detector-aware context and detection-preserving constraints.

This preserves the planned baseline structure. The Harness itself must not reveal group-specific hints or the expert patch.

## Minimal implementation sequence

1. Implement manifest validation and path containment.
2. Implement read-only `search` and `read`.
3. Implement evaluator-owned `run_test` and `run_benchmark` with raw artifact capture.
4. Validate those four tools against unchanged pilot tasks.
5. Implement `edit` but keep it policy-disabled; test only against a disposable synthetic repository.
6. Review logs and replay behavior before authorizing any real optimization Agent.

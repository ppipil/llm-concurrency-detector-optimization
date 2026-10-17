# M5 Preliminary B0/B1 Experiment

> Follow-up: `docs/m5b-baseline-completion.md` records the user-authorized 80k completion run. M5 remains PARTIAL because neither B0 nor B1 produced a patch.

## Result

**M5: PARTIAL**

One valid real B0 Vanilla and one valid real B1 Profiler-Guided Pi/CSLab DeepSeek run were executed on independent native-Windows checkouts and evaluated by M3. Neither Agent produced a patch before the common token limiter fired, so both evaluator results describe unchanged baseline behavior. The pipeline is operational, but this run supports no B0-versus-B1 effectiveness conclusion.

The valid run ID is `20261006T154942.346Z`. It started on 2026-10-06 and completed on 2026-10-07 in Asia/Shanghai. This is a preliminary experiment, not a final research result.

## Frozen Configuration

The configuration is recorded in `experiments/runs/m5-preliminary-sympy-20228/manifest.json`. Both groups used:

- `@earendil-works/pi-coding-agent@1.0.3`;
- CSLab `CS/DeepSeek-V4-Flash-FP8` through the OpenAI-compatible endpoint;
- thinking level `off`;
- `read`, `grep`, `edit`, `write`, and `bash`;
- compaction and retry disabled;
- 20 tool calls, 12 assistant messages, 40,000 accounted tokens, ten minutes, and 8,192 maximum output tokens per response;
- the same task, system prompt, commit, dependencies, and M3 evaluator protocol.

The token check runs after completed assistant-message events. It is therefore an event-level limiter, not a strict pre-request cap, and can overshoot by the final completed response. This limitation affected both groups and is preserved in the evidence.

## Workspaces and Information Boundary

| Group | Workspace | Input treatment |
|---|---|---|
| B0 | `workspaces/m5-r1-b0-sympy-20228` | Task, repository, and correctness/performance objective only |
| B1 | `workspaces/m5-r1-b1-sympy-20228` | Same common input plus sanitized, mechanically rendered M4 profiler tables |

Both began clean at `c237fe7f4c1a4abcfaef0e79600e26cba4ac0a6d`, with independent Python 3.10.8 virtual environments, SymPy 1.7.dev0, and mpmath 1.4.1. Both remained unchanged.

B1 received top-20 tables mechanically ordered by self time, cumulative time, and call-edge cumulative time. Evaluator and measurement-wrapper frames were removed only to enforce the information boundary; no B2 target ranking was performed. The B1 prompt was checked not to contain `workload_windows.py`, evaluator paths, correctness-oracle fields, timeit/runpy wrapper paths, gold patch, gold-touched files, or gold outcomes.

Recorded prompt sizes were 1,301 bytes for B0 and 8,951 bytes for B1.

## Agent Results

| Field | B0 Vanilla | B1 Profiler-Guided |
|---|---:|---:|
| Agent wall time | 286.378 s | 78.681 s |
| Tool calls | 12 | 10 |
| Input tokens | 24,094 | 23,246 |
| Output tokens | 3,233 | 1,669 |
| Cache-read tokens | 30,976 | 18,688 |
| Total accounted tokens | 58,303 | 43,603 |
| Budget trigger | `token_budget` | `token_budget` |
| Terminal result | aborted at event boundary | aborted at event boundary |
| Changed files | none | none |
| Patch | empty | empty |
| Agent-driven correctness test | not reached | not reached |

The zero monetary cost in Pi metadata is not a pricing result; the custom provider has no verified price table.

## Behavior Difference

B0 sequence:

```text
bash, bash, bash, grep, grep, read, bash, bash, bash, bash, bash, read
```

B0 spent most of its trajectory reproducing exponent-dependent behavior and manually isolating individual operations. Near the end it correctly identified that `sign.eval` computes `im(a)` before testing `a.is_imaginary`, causing expensive real/imaginary expansion for large powers. It then read the relevant source, but the token stop fired before an edit.

B1 sequence:

```text
bash, bash, read, read, read, read, read, read, grep
```

B1 used the supplied profile to inspect `complexes.py`, `power.py`, `densearith.py`, and polynomial power implementation immediately. It identified the `Power.as_real_imag -> poly -> dmp_pow/dmp_mul` path but focused on the deep arithmetic hotspot and did not reach a source edit before its token stop.

Thus B1 avoided most of B0's reproduction work and reached the profiled path earlier, while B0 ultimately articulated a more direct potential root cause. Neither produced a patch, so these observations are behavioral only.

## M3 Evaluator Results

Both unchanged workspaces were evaluated with three fresh processes and ten retained unprofiled samples per process.

| Field | B0 | B1 |
|---|---:|---:|
| Correctness | PASS | PASS |
| Tests | 288 passed, 7 skipped, 8 expected failures | same |
| Raw samples | 30 | 30 |
| Mean | 4.477641 s | 4.520701 s |
| Median | 4.439778 s | 4.506302 s |
| Sample std | 0.174697 s | 0.126765 s |
| CV | 3.9015% | 2.8041% |
| Speedup vs M2 | 1.078529× | 1.068256× |
| M3 outcome | `NO_GAIN` | `NO_GAIN` |

All samples were retained and profiler timings were not used. The B0 mean divided by the B1 mean is 0.990475, but this is descriptive only: both source trees are unchanged, there is one run per group, and order was not randomized.

## Superseded Invalid Attempt

The earlier run `20261006T153437.032Z` is retained for provenance but excluded from the valid B0/B1 comparison. Its mechanically rendered B1 table included the evaluator workload filename and wrapper frames. It did not reveal workload source or gold data, but even the path violated the strict evaluator-only boundary.

The controller was corrected to remove evaluator, `timeit`, and `runpy` wrapper frames before prompt construction. Two new clean workspaces were created and both groups were rerun without changing model, tools, budgets, task, or execution order. The invalid attempt's raw files were not deleted or rewritten.

The invalid attempt also produced empty patches. Its stale-baseline M3 labels were `SUCCESS`, demonstrating temporal drift; those labels are preserved only as a validity warning and are not M5 results.

## Evidence

Valid raw evidence:

```text
results/raw/m5/20261006T154942.346Z/
├── B0/
│   ├── prompt.md, system-prompt.md
│   ├── events.jsonl, transcript.json, summary.json
│   ├── patch.diff
│   └── evaluation/
├── B1/
│   └── same structure
├── aggregate.json
└── summary.md
```

The logs preserve full messages, tool arguments/results, usage, patches, tests, commands, and all benchmark samples. No API key is stored.

## Reproduction

Prepare new labeled workspaces:

```powershell
.\scripts\experiments\prepare-m5-workspaces.ps1 -RunLabel <label>
```

Run agents with a shared experiment ID:

```powershell
npm run m5:agent -- --group B0 --workspace workspaces/m5-<label>-b0-sympy-20228 --experiment-id <id>
npm run m5:agent -- --group B1 --workspace workspaces/m5-<label>-b1-sympy-20228 --profile results/raw/profiles/sympy__sympy-20228/20261006T091154.011Z/evidence.json --experiment-id <id>
```

Run M3 separately for each workspace, then aggregate:

```powershell
npm run m5:summarize -- <id>
```

## Limitations and Recommendations

- One run per group and no generated patch are insufficient for an effectiveness conclusion.
- The event-level token limiter overshot substantially; a strict pre-request/remaining-budget mechanism should be designed before formal runs.
- The older M2 comparison showed temporal drift in the invalid attempt. A contemporaneous unchanged-control or interleaved-baseline policy should be proposed and approved before formal causal interpretation.
- B0 can self-profile through the equal `bash` tool. This is a real behavior of the frozen equal-tool design and must be considered when interpreting B0 versus supplied B1 evidence.
- No B2 Context Selector was implemented or run.

# M5g FAST Sanity Validation

## Result

**M5g FAST sanity validation: FAIL.**  
**M5 remains PARTIAL. Do not enter M6 yet.**

This was a development-only sanity check on `sympy__sympy-21391`, not a formal performance experiment. It reused the unchanged `fast-sanity-v1` policy: 60,000 accounted tokens, four minutes, 12 tool calls, eight model turns, and a controller-injected 30-second default bash timeout. The M5e lifecycle implementation and the M5f prompt/context format were not changed.

Both groups ended at a response boundary through the token-budget soft stop. Every tool call that had already started produced a tool result; no tool was aborted. Neither group emitted an `edit` or `write`, changed a source file, or ran a targeted correctness test. The required diagnose -> edit -> targeted-test loop was therefore not completed, and no post-patch evaluator or benchmark was run.

## Results

| Field | B0 Vanilla | B1 Profiler-Guided |
|---|---:|---:|
| Termination | `token_budget` (soft) | `token_budget` (soft) |
| Source patch | no | no |
| Time to first edit | none | none |
| Time to first targeted test | none | none |
| Agent-driven tests | none | none |
| Input tokens | 24,891 | 25,743 |
| Output tokens | 1,077 | 1,643 |
| Cache-read tokens | 34,048 | 36,352 |
| Total/accounted tokens | 60,016 | 63,738 |
| Tool calls | 11 | 10 |
| Model turns | 7 | 6 |
| Wall-clock | 58.085 s | 37.187 s |
| Tool counts | read 7, grep 3, bash 1, edit 0, write 0 | read 4, grep 3, bash 3, edit 0, write 0 |
| Repeated profiling | no | no |
| Repeated search | one duplicated initial implementation-location search | three consecutive test-location searches |
| Outcome | `NO_PATCH` | `NO_PATCH` |

The totals include cache-read tokens. B1 crossed the ceiling at a completed response boundary, so the observed 63,738 total is retained rather than truncated or discarded.

## Action-Timing Evidence

B0 stated that it understood the bottleneck and described a fast-path hypothesis at 44.897 seconds. It then requested one grep and, on the final permitted response, three parallel reads. Those legal reads completed at 58.084 seconds, after which the controller stopped before another model request. No edit was requested.

B1 connected the profiler evidence to `GaussianElement.__init__`, `Domain.convert`, and `_not_a_coeff` and described a fast-path hypothesis at 21.103 seconds. It then used its remaining calls to locate relevant tests: one grep and three shell searches at 32.341, 32.341, 35.015, and 37.032 seconds. The searches did not lead to an edit or test before the token boundary.

## Comparison with M5d

- M5d B0 first requested an edit at 137.758 seconds, but the old lifecycle canceled it. M5g B0 had no lifecycle cancellation and all legal tools completed, but it never requested an edit. Its time to first edit therefore changed from 137.758 seconds to none.
- M5d B1 produced no edit; M5g B1 also produced no edit. In M5g it formed a concrete source hypothesis by 21.103 seconds, then continued test discovery until termination.
- M5e's soft-stop semantics behaved as designed in both real runs: no active tool was canceled when the token boundary was reached. These runs did not independently exercise a real final-turn edit, because neither Agent issued one.
- M5f did not yield an observable improvement in the required action behavior in this single sanity run. The prompts caused both groups to articulate a plausible hypothesis, but neither transitioned to edit and test.

## Remaining Blockers

The immediate blocker is no longer the M5d active-tool cancellation. It is the lack of a completed action loop under the FAST budget: both groups continued repository investigation after stating a concrete hypothesis and exhausted the accounted-token budget before editing.

The token ceiling is reached quickly because accounted usage includes cache-read tokens. This is an observed execution-budget interaction, not grounds to change the frozen policy in this run. B0 also duplicated its initial implementation-location search through bash and grep, while B1 repeated test-location searches.

Environment metadata collection also reported `pip freeze` exit code 2 in both groups because editable-install metadata still referenced the removed `m5d-seed-sympy-21391` worktree path. This did not stop the Agent sessions, but it is a reproducibility-recording defect to resolve before a formal experiment.

The current harness/prompt should not yet be frozen for M6. A further narrowly scoped diagnosis of token accounting and the hypothesis-to-edit transition is warranted, without changing research questions, baseline definitions, or evaluator behavior.

## Evidence

- Run ID: `m5g-20261007T100830.157Z`
- B0 evidence: `results/raw/m5d/m5g-20261007T100830.157Z/B0`
- B1 evidence: `results/raw/m5d/m5g-20261007T100830.157Z/B1`
- Repository revision: `8ddf9c29e345df987e82f8c5905dd0b32ea0a4b6`
- Pi: `@earendil-works/pi-coding-agent@1.0.3`
- Model: `CS/DeepSeek-V4-Flash-FP8`

The run summaries record `evaluatorOrGoldSupplied: false`. B0 received no profiler evidence; B1 received only the M5f mechanical profiler evidence.

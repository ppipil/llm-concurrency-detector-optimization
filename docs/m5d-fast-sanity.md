# M5d FAST Sanity Check

## Result

**M5d FAST sanity: FAIL.**  
**Do not enter M6 yet.**

This was a development sanity check on `sympy__sympy-21391`, not a formal performance experiment. The frozen `agent-execution-v1` policy was not changed. A separate `fast-sanity-v1` policy used 60,000 accounted tokens, four minutes, 12 tools, eight model turns, and a controller-injected 30-second default bash timeout.

Neither B0 nor B1 produced a source patch or ran a targeted correctness test. Consequently, neither ran the lightweight post-patch evaluator or benchmark.

## Results

| Field | B0 Vanilla | B1 Profiler-Guided |
|---|---:|---:|
| Termination | `assistant_message_budget` | `token_budget` |
| Source patch | no | no |
| Time to first edit attempt | 137.758 s | none |
| First edit completed | no: `Operation aborted` | n/a |
| Targeted Agent test | no | no |
| Input tokens | 23,858 | 25,712 |
| Output tokens | 2,493 | 1,038 |
| Cache-read tokens | 45,312 | 43,264 |
| Total recorded tokens | 71,663 | 70,014 |
| Tool calls | 11 | 10 |
| Model turns | 8 | 6 |
| Wall-clock | 137.761 s | 43.272 s |
| Post-patch evaluator | skipped: `NO_PATCH` | skipped: `NO_PATCH` |

Both token totals include completed-response boundary overshoot and are preserved as observed cost.

## Important Harness Finding

B0 diagnosed a concrete optimization and issued an `edit` call on its eighth model turn. The controller requested termination at the assistant-message boundary before the associated tool completed. The edit tool started at 137.758 seconds but returned `Operation aborted`, leaving the checkout unchanged.

This is a controller lifecycle defect for tool-using terminal turns: a turn limit must allow tool calls emitted by the permitted final model turn to complete, then prevent the next model turn. It is not evidence that DeepSeek failed to identify a possible edit.

B1 consumed its token budget while reading and searching the profiler-identified paths and never issued an edit.

## Task-Specific Interpretation

The run does **not** establish that the earlier `sympy__sympy-20228` failures were task-specific. B0 got as far as a concrete edit attempt on the second task, which is suggestive, but the controller canceled it and no targeted test followed. B1 still did not edit. A completed diagnose → edit → targeted-test loop is required before making that attribution.

M6 should not begin until the final-permitted-turn tool lifecycle is fixed and revalidated. This is a harness blocker, not a request to alter the research questions, baseline definitions, or frozen formal execution policy.

## Evidence

- Run ID: `20261007T034634.504Z`
- Raw Agent evidence: `results/raw/m5d/20261007T034634.504Z/B0` and `B1`
- Machine-readable aggregate: `results/raw/m5d/20261007T034634.504Z/aggregate.json`
- Baseline cProfile evidence: `results/raw/m5d/20261007T034634.504Z/profile-baseline`
- Five-sample unchanged sanity baseline mean: `0.04183764003682881` seconds; development-only, not a formal benchmark result.

The B1 prompt contains task-specific profiler evidence only. Evaluator workload, test selection, post-edit results, and expert/gold information were not supplied to either Agent.

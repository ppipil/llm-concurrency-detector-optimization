# M5c Frozen Agent Execution Protocol

## Result

**Execution protocol validation: PASS.**  
**M5 overall: PARTIAL.**

The research controller now owns a single `agent-execution-v1` policy for all subsequent B0/B1/B2/B3 runs. Pi 1.0.3 source was not modified. One new B0 run and one new B1 run executed on independent native-Windows workspaces. Both reached a controller limit normally, but neither produced a source patch or ran targeted tests, so both are unsuccessful `NO_PATCH` attempts.

Because neither group produced a source patch, the complete M3 correctness and 30-sample benchmark evaluation was intentionally not run.

## Frozen Execution Policy

| Limit | Value |
|---|---:|
| Accounted-token ceiling | 100,000 |
| Per-run wall-clock | 600 seconds |
| Maximum tool calls | 20 |
| Maximum model turns | 12 |
| Default bash timeout | 60 seconds |
| Maximum output tokens per response | 8,192 |

The authoritative implementation is `scripts/research-controller/execution-policy.mjs`. The exported policy object is frozen. The controller creates a custom Pi bash tool definition with Pi's public `createBashToolDefinition` and `createLocalBashOperations` APIs. Its operations wrapper supplies 60 seconds whenever the model omits `timeout`; no Pi package file is changed.

Token and turn checks occur at completed assistant-message boundaries. A terminal abort event is not counted as a model turn. Because a provider response is atomic from the controller's perspective, the final response may take the recorded token total above 100,000; B1 demonstrates this limitation.

Four controller tests verify the constants, object freezing, default timeout injection, explicit timeout preservation, and the Pi tool-definition integration.

## Common Prompt Policy

Both groups received the same general constraints:

- diagnose the bottleneck, implement one concrete performance optimization, and run targeted tests;
- do not spend the entire budget only analyzing;
- do not enlarge the formal workload's inputs for expensive exploration;
- do not read evaluator-only, hidden-oracle, expert, or gold information.

The prompt does not contain B2-specific ranking guidance and does not prescribe an edit on a numbered turn. B0 received no profiler evidence. B1 received only the sanitized mechanical M4 profiler tables.

## Runs

Experiment ID: `20261006T170423.670Z`

| Field | B0 Vanilla | B1 Profiler-Guided |
|---|---:|---:|
| Workspace | `workspaces/m5-c-b0-sympy-20228` | `workspaces/m5-c-b1-sympy-20228` |
| Termination | `assistant_message_budget` | `token_budget` |
| Attempt outcome | `NO_PATCH` | `NO_PATCH` |
| Model turns | 12 | 9 |
| Tool calls | 14 | 11 |
| Input tokens | 22,949 | 31,032 |
| Output tokens | 4,089 | 3,085 |
| Cache-read tokens | 47,104 | 76,800 |
| Total recorded tokens | 74,142 | 110,917 |
| Agent wall-clock | 273.803 s | 173.767 s |
| Agent-driven targeted tests | none | none |
| Source patch | none | none |
| Full M3 evaluator | skipped: no patch | skipped: no patch |

B0 used 14 bash calls. All 14 omitted the timeout argument and all 14 received the controller's 60-second default. One exploratory exponent-400 profiling command timed out after an observed 60.482 seconds, after which the Agent continued. This validates that a single command no longer consumes the ten-minute run budget. B0 created an untracked `prof.out` capture; it is a generated profiler artifact, not a source patch, and did not trigger M3.

B1 used 11 tools, including six bash calls. All six omitted timeout and received the same 60-second default. Its longest bash call was 30.726 seconds. It exhausted the event-boundary token budget before editing. The final response caused a 10,917-token overshoot; the run did not hang and the controller terminated it normally.

## Patch and Evaluation Result

There is no correctness, speedup, or M3 outcome for either group because no source patch exists. Assigning `NO_GAIN` based on an unchanged checkout would misrepresent an unsuccessful Agent attempt, so the M5c classification is `NO_PATCH` and the expensive benchmark is skipped exactly as specified.

## Harness Assessment

The two M5b execution blockers are addressed at the controller level:

- individual bash commands have a real default timeout;
- the Agent loop has common tool, turn, token, and wall-clock limits.

No execution-blocking harness defect appeared in these two runs. The remaining limitation is that token accounting is enforced at response boundaries and can overshoot by one response. This must be reported in cost data, but it did not prevent clean termination. The lack of patches is now Agent behavior under a functioning common protocol, not evidence of an uncontrolled bash command or infinite loop.

M5 remains PARTIAL because B0 and B1 still have not produced patches that can be evaluated for correctness and speedup. M5c validates the protocol, not optimization effectiveness.

## Evidence and Reproduction

Raw evidence and the machine-readable aggregate are under:

```text
results/raw/m5c/20261006T170423.670Z/
├── B0/
├── B1/
├── aggregate.json
└── summary.md
```

Reproduction commands:

```powershell
npm run m5c:agent -- --group B0 --workspace <clean-b0-workspace> --experiment-id <id>
npm run m5c:agent -- --group B1 --workspace <clean-b1-workspace> --profile results/raw/profiles/sympy__sympy-20228/20261006T091154.011Z/evidence.json --experiment-id <id>
npm run m5c:summarize -- results/raw/m5c/<id>
```

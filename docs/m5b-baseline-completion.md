# M5b Baseline Completion Run

> Follow-up: `docs/m5c-frozen-execution-protocol.md` freezes and validates the common Agent execution protocol. The protocol passes, while M5 remains PARTIAL because neither new baseline produced a source patch.

## Result

**M5b: PARTIAL. M5 remains PARTIAL.**

One valid B0 Vanilla run and one valid B1 Profiler-Guided run reached the shared fixed execution limits and were independently evaluated by M3 on native Windows. Neither Agent produced a source patch. The increased budget therefore completed another real baseline attempt, but it did not complete the intended patch-and-evaluate comparison and does not justify updating M5 to PASS.

This is a preliminary experiment, not a final B0-versus-B1 research conclusion.

## Controlled Change

The only experimental adjustment relative to the validated M5 pipeline was the common execution budget and the user-requested common prompt instruction to reach a patch early and reserve budget for tests:

- accounted-token ceiling: 80,000;
- maximum tool calls: 30;
- maximum assistant turns: 20;
- wall-clock ceiling: 600 seconds;
- maximum output tokens per response: 8,192.

The model, Pi 1.0.3 harness, task, commit, tools, evaluator, test selection, benchmark, and B0/B1 treatments were unchanged. B0 received no profiler evidence. B1 received only the sanitized mechanical M4 profiler tables. Neither received evaluator-only or gold information.

Token and turn limits are checked at completed-message boundaries. The token ceiling can therefore overshoot by the final response. Tool termination is requested after the 30th tool completes. A single long-running tool can consume the wall-clock budget; this occurred in B0.

The frozen configuration is in `experiments/runs/m5b-baseline-completion-sympy-20228/manifest.json`.

## Valid Runs

| Field | B0 Vanilla | B1 Profiler-Guided |
|---|---:|---:|
| Evidence directory | `results/raw/m5/20261006T162449.939Z/B0` | `results/raw/m5/20261006T163833.506Z/B1` |
| Workspace | `workspaces/m5-b2-b0-sympy-20228` | `workspaces/m5-b3-b1-sympy-20228` |
| Agent wall time | 600.555 s | 161.517 s |
| Assistant turns | 4 | 9 |
| Tool calls | 4 | 11 |
| Input tokens | 4,061 | 31,676 |
| Output tokens | 746 | 1,399 |
| Cache-read tokens | 2,048 | 53,760 |
| Total accounted tokens | 6,855 | 86,835 |
| Termination | `wall_clock_budget` | `token_budget` |
| Changed files | none | none |
| Patch | empty | empty |

B0 tool sequence:

```text
bash, bash, bash, bash
```

B0 spent the remaining wall-clock budget inside an Agent-selected command that attempted `expand()` and `simplify()` for exponents up to 800 and 1000. The controller aborted the command at the fixed ten-minute boundary. This is preserved as observed Vanilla-Agent behavior.

B1 tool sequence:

```text
bash, read, read, read, read, bash, bash, read, bash, bash, bash
```

B1 used the supplied profiler context to inspect and test relevant paths, but its ninth assistant response raised the event-level total from below the ceiling to 86,835 tokens. The controller then requested termination before an edit.

## M3 Evaluation

The two evaluators ran sequentially to avoid concurrent benchmark interference. Each used three fresh benchmark processes and retained all ten samples per process. Profiler runtime was not used.

| Field | B0 | B1 |
|---|---:|---:|
| Correctness | PASS | PASS |
| Tests | 288 passed, 7 skipped, 8 expected failures | same |
| Raw samples | 30 | 30 |
| Mean | 4.478430 s | 4.435206 s |
| Median | 4.498540 s | 4.412191 s |
| Sample std | 0.131705 s | 0.095613 s |
| CV | 2.9409% | 2.1558% |
| Speedup vs M2 | 1.078339× | 1.088848× |
| M3 outcome | `NO_GAIN` | `NO_GAIN` |

Both source trees were unchanged. The reported speedups are comparisons with the older M2 baseline and are below the provisional 1.102772× success boundary. More importantly, no code change exists to which either timing difference could be attributed. These are no-patch baseline measurements, not Agent optimization results.

## Excluded Infrastructure Failures

Two attempts are retained but excluded from the treatment comparison:

- `results/raw/m5/20261006T161920.772Z/B0`: CSLab `Request timed out` after 7 tools and 33,775 tokens; no patch.
- `results/raw/m5/20261006T162449.939Z/B1`: CSLab `Request timed out` after 11 tools and 55,873 tokens; no patch.

The B0 timeout caused both groups to be restarted symmetrically on fresh workspaces. After the new B0 produced a valid fixed-budget outcome, only the infrastructure-failed B1 was retried. No valid outcome was discarded in search of a favorable patch.

## Evidence and Reproduction

The cross-run aggregate is stored under `results/raw/m5b/baseline-completion-20261007/` as `aggregate.json` and `summary.md`. Raw evidence directories contain exact prompts, full event streams and transcripts, usage, Git status, patch files, and nested evaluator evidence. No API key is recorded.

The commands below record the historical M5b controller interface. The active controller now enforces the later frozen M5c protocol; exact M5b replay therefore requires the repository revision associated with this report.

Run either group with the M5b limits:

```powershell
npm run m5:agent -- --group B0 --workspace <clean-b0-workspace> --experiment-id <id> --token-ceiling 80000 --max-tool-calls 30 --max-turns 20 --prompt-mode completion
npm run m5:agent -- --group B1 --workspace <clean-b1-workspace> --profile results/raw/profiles/sympy__sympy-20228/20261006T091154.011Z/evidence.json --experiment-id <id> --token-ceiling 80000 --max-tool-calls 30 --max-turns 20 --prompt-mode completion
```

Run M3 independently for each final workspace, then aggregate:

```powershell
npm run m5b:summarize -- --b0 <b0-evidence-dir> --b1 <b1-evidence-dir> --output <aggregate-dir>
```

## Interpretation

M5 cannot be updated to PASS because neither baseline produced a patch or reached Agent-driven verification. The run does demonstrate that merely increasing the global token ceiling does not guarantee completion: B0 was limited by an unbounded expensive tool command, while B1 still exhausted event-level token accounting before editing. Addressing those harness-control issues would be a separately recorded implementation change; it is not silently applied to this run.

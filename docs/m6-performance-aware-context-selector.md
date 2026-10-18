# M6 Performance-Aware Context Selector MVP

M6 implements the first minimal, runnable B2 selector and one real `hips_autograd_319` calibration. This is a single calibration observation, not a formal statistical result.

## Selector boundary

The deterministic, program-controlled selector consumes only pre-Agent baseline `cProfile` evidence, the Agent-visible task description, source lines from a clean base-commit checkout, baseline tests, and profiler caller-callee relationships. It does not read B0/B1 run directories, patches, touched-file metadata, post-edit runtimes, gold data, historical outcomes, or LLM-generated rankings. No rule names `tanh`, Autograd, or a known patch.

The task-focus extractor prefers explicit Markdown `Initial Observations`, then `Performance Symptom`, then `Task Description`, falling back to the full document. This keeps generic workflow and long issue text from dominating lexical relevance without using repository-specific terms.

## Scoring

```text
Score =
  0.25 * RuntimeImportance
+ 0.10 * CallFrequency
+ 0.30 * TaskCallRelevance
+ 0.20 * Editability
+ 0.15 * TestSupport
- 0.10 * RegressionRisk
```

- `RuntimeImportance`: maximum of self and bounded cumulative share, normalized over candidates.
- `CallFrequency`: log-scaled call count.
- `TaskCallRelevance`: source/task lexical overlap plus half-strength one-hop propagation over profiler call edges.
- `Editability`: repository-owned frame with an available source line.
- `TestSupport`: baseline test files containing task terms matched at the candidate source.
- `RegressionRisk`: normalized profiler call-graph degree.

The complete ranking, features, reasons, selected targets, budget exclusions, snippets, tests, and call edges are retained in `experiments/runs/m6-hips-autograd-319-b2/selector-audit.json`.

## Equal evidence budget

B1 contained 2,182 characters, approximately 546 tokens using Pi's documented one-token-per-four-characters approximation. B2 used the same ceiling and emitted 2,145 characters, approximately 537 tokens. This proxy is reproducible but is not an exact DeepSeek tokenizer count.

Selected targets:

1. `autograd/numpy/numpy_grads.py:75`, score 0.699912: direct `cosh`/`tanh` task match, 50 calls, editable source, related tests, and low graph-degree risk.
2. `autograd/core.py:70`, score 0.625155: high runtime/call frequency but a maximum centrality risk penalty.
3. `benchmarks/bench_rnn.py:42`, score 0.531682: high cumulative runtime and a one-hop relation to a task-matched path.

Two earlier selector drafts are retained only in ignored development output and were never supplied to the Agent. They revealed that generic workflow/issue text polluted lexical relevance; the final generic heading-priority rule corrected this before the only B2 model run.

## B2 calibration

- Base commit: `809e1b2ba5d7b9d76a7e1a5b67a10089a9c9052a`
- Model, harness, tools, prompt, evaluator, and execution policy: identical to B0/B1
- First hypothesis: 15.491 s, turn 2
- First edit: 42.951 s, turn 5
- First targeted test: 45.655 s, turn 6
- Final patch: `g * (1 - ans * ans)` in the selected `tanh` VJP
- Independent correctness: 42 passed
- Turns/tools: 30/34 (`bash`: 21, `edit`: 2, `grep`: 4, `read`: 7)
- Wall-clock: 315.285 s
- Termination: `model_turn_budget` soft stop

Usage telemetry:

| Field | Value |
| --- | ---: |
| Provider total | 494,927 |
| Uncached input | 53,401 |
| Cache read | 431,104 |
| Output | 10,422 |
| Provider requests | 30 |
| Final context | 28,207 / 128,000 |

## Performance evaluation

The fixed unprofiled workload was `benchmarks.bench_rnn.RNNSuite.time_rnn_grad`, with one warm-up and seven samples per side.

| Measurement | Before | After |
| --- | ---: | ---: |
| Mean | 0.2497760000 s | 0.2493161857 s |
| Median | 0.2498838000 s | 0.2501426000 s |
| Sample standard deviation | 0.0027286633 s | 0.0048262005 s |
| CV | 1.092% | 1.936% |
| Mean speedup | 1.0000x | 1.00184430x |

Under the current preliminary 10% noise floor, the outcome is `NO_GAIN`. The Agent's local derivative microbenchmark is not the formal workload and is not used for classification.

## B0/B1/B2 calibration comparison

| Field | B0 | B1 | B2 |
| --- | ---: | ---: | ---: |
| First hypothesis | 17.852 s | 32.132 s | 15.491 s |
| First edit | 58.582 s | 79.040 s | 42.951 s |
| First targeted test | 61.468 s | 82.171 s | 45.655 s |
| Turns / tools | 27 / 35 | 30 / 44 | 30 / 34 |
| Wall-clock | 205.119 s | 341.110 s | 315.285 s |
| Provider total | 639,970 | 826,506 | 494,927 |
| Correctness | 42 passed | 42 passed | 42 passed |
| Patch | `1 - ans**2` | `1 - ans**2` | `1 - ans * ans` |
| Measured speedup | 1.02219x | 1.10054x | 1.00184x |
| Termination | complete | turn budget | turn budget |

B2 reached hypothesis/edit/test sooner than both B0 and B1 and used fewer tools/tokens than B1. It did not produce a meaningful workload speedup. Different one-off baseline samples make the speedup columns unsuitable for causal or statistical claims.

## Limitations

- Relevance is lexical and one-hop; synonyms and longer dependencies may be missed.
- Risk is graph centrality, not a semantic regression model.
- Test discovery uses token occurrence and can return broad matches.
- cProfile provides function start lines, not line-level timing.
- Character-based token budgeting is approximate.
- A single task/run cannot establish that B2 is better than B0/B1.
- The selected target had low direct runtime share but high task relevance; this limitation is retained rather than inflating runtime evidence.

# M5 `hips_autograd_319` B1 Profiler-Guided calibration

This was one real B1 calibration run, not a formal experiment. It used the same task, model, Pi version, prompt skeleton, tools, correctness command, workload, and calibration budget as the successful B0 run. The sole group-level prompt difference was mechanically rendered profiler evidence.

## Isolation and pre-Agent profiling

- Repository: `HIPS/autograd`
- Base commit: `809e1b2ba5d7b9d76a7e1a5b67a10089a9c9052a`
- Harness: `@earendil-works/pi-coding-agent@1.0.3`
- Model: CSLab `CS/DeepSeek-V4-Flash-FP8`
- Budget: 10 minutes, 30 model turns, 45 tool calls, 60-second default bash timeout
- Profiler: CPython `cProfile` 3.10.8
- Profile run ID: `20261017T150105.401Z`
- Profile input: unchanged base-commit checkout and `benchmarks.bench_rnn.RNNSuite.time_rnn_grad`
- Profile status: PASS; checkout unchanged after profiling
- Profiler output was marked ineligible for speedup calculation.

The B1 context was generated before the Agent run through the fixed mechanical formatter: Top 8 self-time functions, Top 8 cumulative-time functions, and Top 8 caller-callee edges. A public-safe copy is preserved at `experiments/runs/m5k-hips-autograd-319-b1/performance-context.txt`; only the absolute workspace prefix was deterministically replaced by `<workspace>`. The manifest retains the SHA-256 of the exact raw injected bytes. The context contained neither the B0 patch nor B0 post-edit results, gold patch/touched-file data, or the final optimization expression.

The effective B1 prompt was 9,636 characters. Replacing the B1 evidence block with the B0 empty-context marker made the prompt byte-for-byte equivalent to B0's shared skeleton. The saved raw prompt contains the injected context exactly.

## Agent trajectory

- First concrete hypothesis: 32.132 s, turn 6. Reuse the already computed `tanh` result and replace the extra `cosh` evaluation with the equivalent derivative identity.
- First edit: 79.040 s, turn 12.
- First targeted test: 82.171 s, turn 13.
- Patch: one line in `autograd/numpy/numpy_grads.py`; identical to the B0 calibration patch.
- Agent-selected targeted tanh tests: 2 passed.
- Independent evaluator command: 42 passed, exit code 0.
- Model turns: 30.
- Tool calls: 44 (`bash`: 43, `edit`: 1).
- Wall-clock: 341.110 s.
- Termination: `model_turn_budget` soft stop.

The Agent continued with broader tests, microbenchmarks, and repeated ASV checks after its patch. It reached the model-turn boundary while two final legal test calls were allowed to complete; the M5e lifecycle bug did not recur.

## Usage telemetry

| Field | Value |
| --- | ---: |
| Provider total | 826,506 |
| Uncached input | 90,477 |
| Cache read | 720,896 |
| Cache write | 0 |
| Output | 15,133 |
| Reasoning | 0 |
| Provider requests | 30 |
| Final current context | 46,006 / 128,000 tokens |

Provider total was telemetry only and did not stop the run.

## Independent correctness and performance evaluation

Correctness command:

```powershell
.venv\Scripts\python.exe -m pytest tests\test_scalar_ops.py tests\test_systematic.py::test_tanh -q --disable-warnings
```

Result: 42 passed, 17 warnings, exit code 0.

Benchmark workload: `benchmarks.bench_rnn.RNNSuite.time_rnn_grad`. Both measurements were unprofiled and used one warm-up plus seven timed samples.

| Measurement | Before | After |
| --- | ---: | ---: |
| Mean | 0.2886545571 s | 0.2622838857 s |
| Median | 0.2922634000 s | 0.2626131000 s |
| Sample standard deviation | 0.0119389777 s | 0.0059301899 s |
| CV | 4.136% | 2.261% |
| Mean-based speedup | 1.0000x | 1.10054248x |

Before samples (seconds):

```text
0.2922634, 0.2659811, 0.2968396, 0.2979638, 0.2998918, 0.2846780, 0.2829642
```

After samples (seconds):

```text
0.2626131, 0.2617618, 0.2669435, 0.2684208, 0.2624740, 0.2500694, 0.2637046
```

This measured improvement is a calibration observation, not a formal B1 result. B0 and B1 used different run-time samples and the B1 pre-edit mean was materially slower than B0's pre-edit mean; the apparent cross-run difference must not be attributed to profiler guidance.

## B0/B1 behavioral comparison

| Field | B0 | B1 |
| --- | ---: | ---: |
| First hypothesis | 17.852 s | 32.132 s |
| First edit | 58.582 s | 79.040 s |
| First targeted test | 61.468 s | 82.171 s |
| Turns / tools | 27 / 35 | 30 / 44 |
| Wall-clock | 205.119 s | 341.110 s |
| Termination | `assistant_complete` | `model_turn_budget` |
| Correctness | 42 passed | 42 passed |
| Mean speedup | 1.02219x | 1.10054x |

Both runs produced the same patch. The mechanical profile was dominated by NumPy dispatch and Autograd core/tensordot frames rather than directly listing the `tanh` VJP. The task description itself contained the tanh/cosh symptom. B1 therefore does not demonstrate that profiler evidence caused the successful patch, and in this single calibration it did not shorten the action loop.

## Reproduction commands

Run from the research repository root in native PowerShell, with `CSLAB_API_KEY` already present in the process environment. The checkout must be clean at the fixed base commit.

```powershell
$workspace = (Resolve-Path 'workspaces\m5k-autograd-319-b1').Path
$python = Join-Path $workspace '.venv\Scripts\python.exe'
$profileOutput = 'results\raw\profiles\hips_autograd_319\B1-pre-agent-20261017'

& $python scripts\performance-evidence\collect_sympy_20228.py `
  --workspace $workspace `
  --task-id hips_autograd_319 `
  --manifest experiments\tasks\formulacode-hips-autograd-319\evaluator\manifest.json `
  --workload scripts\evaluation\benchmark-formulacode-autograd-319.py `
  --callable measure `
  --top 20 `
  --output $profileOutput

$env:M5K_WORKSPACE = $workspace
$env:M5K_TASK_PATH = (Resolve-Path 'experiments\tasks\formulacode-hips-autograd-319\agent\task.md').Path
$env:M5K_TASK_ID = 'hips_autograd_319'
$env:M5K_GROUP = 'B1'
$env:M5K_PROFILE_EVIDENCE = (Resolve-Path "$profileOutput\evidence.json").Path
$env:M5K_EVIDENCE_DIR = Join-Path (Get-Location) 'results\raw\m5k\hips_autograd_319\B1-run-20261017'
$env:M5K_BASE_COMMIT = '809e1b2ba5d7b9d76a7e1a5b67a10089a9c9052a'
node scripts\experiments\run-m5k-formulacode-b0.mjs
```

Independent validation is performed from the target checkout:

```powershell
.venv\Scripts\python.exe -m pytest tests\test_scalar_ops.py tests\test_systematic.py::test_tanh -q --disable-warnings
.venv\Scripts\python.exe <research-root>\scripts\evaluation\benchmark-formulacode-autograd-319.py --warmups 1 --samples 7
```

## Raw evidence

Full local records are retained under ignored directories:

- Pre-Agent profile: `results/raw/profiles/hips_autograd_319/B1-pre-agent-20261017/`
- B1 run: `results/raw/m5k/hips_autograd_319/B1-run-20261017/`

The B1 run directory contains the final prompt, system prompt, exact performance context, event stream, transcript, patch, summary, and before/after benchmark JSON. The immutable, commit-friendly manifest records SHA-256 hashes for these raw artifacts; future runs must use a new run directory rather than overwrite this checkpoint.

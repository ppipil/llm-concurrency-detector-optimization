# M5 real-repository B0 calibration: `hips_autograd_319`

This record summarizes a real-repository positive capability calibration. It is **not formal B0/B1/B2/B3 experiment data** and must not be used as such.

## Fixed task and isolation

- FormulaCode task: `hips_autograd_319`
- Repository: `HIPS/autograd`
- Base commit: `809e1b2ba5d7b9d76a7e1a5b67a10089a9c9052a`
- Group: B0 Vanilla only
- Agent harness: `@earendil-works/pi-coding-agent@1.0.3`
- Model: CSLab `CS/DeepSeek-V4-Flash-FP8`
- Agent-visible task input: `experiments/tasks/formulacode-hips-autograd-319/agent/task.md`
- Evaluator-only and gold information was not provided to the Agent.
- The third-party checkout remained under ignored `workspaces/`.

The run used the B0/B1 shared diagnose-act-validate guidance. The calibration-only execution budget was 30 model turns, 45 tool calls, 10 minutes wall-clock, and a 60-second default bash timeout. The provider-token action stop and emergency provider cap were disabled.

## Agent trajectory

- First concrete hypothesis: 17.852 s. The Agent proposed reusing the already computed `tanh` result through the identity `tanh'(x) = 1 - ans**2`, avoiding another `cosh` call and its overflow behavior.
- First source edit: 58.582 s.
- First targeted test: 61.468 s.
- Final counts: 27 model turns and 35 tool calls (`bash`: 32, `read`: 2, `edit`: 1).
- Wall-clock: 205.119 s.
- Termination: `assistant_complete`.

The resulting one-line source patch changed `autograd/numpy/numpy_grads.py`; it is preserved in `experiments/runs/m5k-hips-autograd-319/agent.patch` for research provenance only.

## Independent validation

Correctness command:

```powershell
.venv\Scripts\python.exe -m pytest tests\test_scalar_ops.py tests\test_systematic.py::test_tanh -q --disable-warnings
```

Result: exit code 0, 42 tests passed (17 warnings).

The unprofiled workload was `benchmarks.bench_rnn.RNNSuite.time_rnn_grad`. Each side used one warm-up followed by seven samples.

| Measurement | Baseline | Optimized |
| --- | ---: | ---: |
| Mean | 0.2678700000 s | 0.2620545714 s |
| Median | 0.2681295000 s | 0.2618528000 s |
| Sample standard deviation | 0.0035593583 s | 0.0065372468 s |
| Mean-based speedup | 1.0000x | 1.02219167x |

Baseline samples (seconds):

```text
0.2724068, 0.2694351, 0.2654805, 0.2621563, 0.2712945, 0.2661873, 0.2681295
```

Optimized samples (seconds):

```text
0.2748902, 0.2617460, 0.2568204, 0.2628952, 0.2540909, 0.2620865, 0.2618528
```

The measured mean improvement is small and the optimized samples are noisier. This calibration establishes that the Agent completed the diagnose-edit-test-benchmark loop; it does not establish a formal performance result.

## Evidence retention

The committed manifest contains the compact machine-readable record. Full prompts, event streams, transcripts, and raw command output remain locally under ignored `results/raw/` because they are bulky operational artifacts. No credential value is stored in either form.

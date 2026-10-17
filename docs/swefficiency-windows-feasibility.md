# SWE-fficiency Native Windows Feasibility Study

> **Current-plan note:** The task-structure, Windows-feasibility, and candidate-screening evidence in this document supports the repository-level performance tasks required by Research Plan v2. It is static feasibility evidence, not a record of successful Native-Windows execution.

## Scope and evidence status

This study investigates whether a small subset of SWE-fficiency can support a native-Windows pilot for Performance-Aware Context Management. It does not change the frozen research questions, B0–B3 baselines, or evaluation metrics.

No task repository was built or benchmarked during this study. The task classifications below are static feasibility judgments based on the official benchmark repository, dataset rows, gold report, and workload source. A task becomes **Windows-verified** only after its exact base commit builds, its unchanged correctness oracle passes, and its unchanged workload produces repeatable measurements on the native-Windows host.

Evidence inspected on 2026-10-05:

- Official repository: `swefficiency/swefficiency`, commit `12d32a2d6800824a7d84bdb6797b5708e7b7957f`.
- Official dataset: 498 rows in the `test` split.
- Official gold report: `eval_reports/eval_report_gold.csv` in that repository.
- Official Lite selection metadata under `analysis/adhoc/make_lite/lite_selection/`.

Primary sources: [official GitHub repository](https://github.com/swefficiency/swefficiency), [official Hugging Face dataset](https://huggingface.co/datasets/swefficiency/swefficiency), and [benchmark paper](https://arxiv.org/abs/2511.06090).

## 1. Task structure

Each dataset row contains at least:

- repository and immutable `base_commit`;
- instance identifier and environment/image metadata;
- expert patch and repository rebuild command;
- a standalone Python performance `workload`;
- `PASS_TO_PASS`, `FAIL_TO_PASS`, `covering_tests`, and a repository test command;
- optional single-thread test metadata.

The benchmark is pass-to-pass performance engineering: the workload is timed separately from the correctness tests. A patch is valid only if the selected repository tests continue to pass. The official metric compares model speedup with expert speedup.

Relevant implementation locations in the inspected benchmark checkout:

- `swefficiency/harness/test_spec.py`: `TestSpec`, task parsing, generated environment/evaluation/performance/correctness scripts.
- `swefficiency/harness/run_evaluation.py`: Docker execution, workload copying, pre/post timing, test execution, and log capture.
- `swefficiency/harness/grading.py`: `PASS_TO_PASS` and `FAIL_TO_PASS` grading.
- `swefficiency/harness/utils.py`: dataset loading.
- `swefficiency/harness/run_to_run_isolation.py`: parsing and run-to-run isolation support.
- `scripts/inference/README.md`: agent-generation integration using prebuilt Docker images.

## 2. Why the official harness is not native-Windows ready

The official evaluation path recommends a Linux host and prebuilt Docker images. `test_spec.py` emits Bash scripts (`#!/bin/bash`), POSIX environment assignments and commands, and `/testbed`/`/tmp` paths. `run_evaluation.py` uses the Docker API and executes inside `/testbed`. The VM setup scripts also assume Linux tooling and CPU pinning.

Therefore:

- the dataset and individual Python workloads can be adapted to native Windows;
- the official harness cannot be called a native-Windows harness;
- Windows pilot numbers will not be directly comparable to the published Linux/container gold numbers;
- the original task semantics must be preserved while translating command invocation, paths, and environment-variable syntax.

## 3. Repository-level Windows triage

| Repository family | Native-Windows source feasibility | Pilot status | Main reason |
|---|---:|---|---|
| SymPy | High, pending execution | Preferred | Predominantly pure Python; editable source installs and focused workloads do not require a native compiler in the common case. |
| Dask | Medium-high, task-dependent | Preferred reserve | Predominantly Python, but individual tasks may depend on pandas, distributed scheduling, or Windows `spawn` multiprocessing behavior. |
| xarray | Medium, task-dependent | Reserve | Python-owned code, but depends on compatible NumPy/pandas builds; the inspected Lite candidate is too large for the first pilot. |
| Matplotlib | Medium-low for historical commits | Exclude initially | Source checkout imports native extensions; individual workloads may also require a GUI backend, image libraries, or FFmpeg. |
| pandas | Low for first pilot | Exclude initially | Historical source builds are compiler/Cython/NumPy-ABI sensitive. |
| NumPy | Low for first pilot | Exclude initially | Native compilation and BLAS/runtime configuration dominate setup and can dominate hotspots. |
| SciPy | Low for first pilot | Exclude initially | Native C/C++/Fortran build chain and BLAS/LAPACK dependencies. |
| scikit-learn | Low for first pilot | Exclude initially | Historical Cython/native build and dependency compatibility risk. |
| Astropy | Low-medium, task-dependent | Exclude initially | Mixed Python/native code and historical build dependency risk. |

“High” means suitable for an execution pilot, not already verified. Exact historical commits can still require older Python or dependency versions.

## 4. Provisional shortlist: five small tasks

The shortlist deliberately favors one-file expert patches, pure-Python ownership, short workloads, and an executable correctness oracle. Patch length, runtime, and speedup below are **official gold-report reference values**, not measurements from this Windows machine.

| Priority | Instance | Base commit | Expert-touched file | Patch lines | Gold pre-edit runtime | Gold speedup | Oracle size | Windows assessment |
|---:|---|---|---|---:|---:|---:|---:|---|
| 1 | `sympy__sympy-20228` | `c237fe7f4c1a4abcfaef0e79600e26cba4ac0a6d` | `sympy/functions/elementary/complexes.py` | 28 | 6.09 s | 186.07x | 285 P2P; 8 covering files | Strong pilot candidate; compact deterministic symbolic workload. Very large gold speedup must be revalidated. |
| 2 | `sympy__sympy-21391` | `8ddf9c29e345df987e82f8c5905dd0b32ea0a4b6` | `sympy/polys/domains/gaussiandomains.py` | 27 | 4.91 s | 2.13x | 877 P2P; 40 covering files | Strong candidate; workload is moderate, but random matrices require a fixed seed for cross-run input identity or a documented decision to retain the original randomness. |
| 3 | `sympy__sympy-16134` | `2dd1275d6050605f517b030c92e9ef30c75eab45` | `sympy/logic/boolalg.py` | 47 | 22.04 s | 8785.43x | 50 P2P; 1 covering file | Easy oracle and pure Python, but the extreme speedup is a red flag for timeout/algorithmic-regime sensitivity. Pilot, do not assume comparability. |
| 4 | `sympy__sympy-19270` | `37df6c20f5fd7511e18685de40a4d47928c3ac88` | `sympy/polys/polytools.py` | 58 | 0.50 s | 1.32x | 816 P2P; 37 covering files | Small code change, but the individual workload is short and the expected gain is modest; requires process-level repetitions and noise checks. |
| 5 | `dask__dask-5501` | `6d878e68248a12f15bb958951111efe8b030d9e8` | `dask/utils.py` | 18 | 0.66 s | 4.01x | 183 P2P; 7 covering files | Useful second-repository task. Must verify scheduler behavior and multiprocessing/distributed tests on Windows. |

The machine-readable version is in `experiments/swefficiency-windows-candidates.json`.

### Near-misses not selected for the first five

- `dask__dask-10922`: one-file, 17-line patch, but the official pre-edit workload is about 65.7 seconds and creates 500,000 dataframe rows. It is not a small first workload.
- `matplotlib__matplotlib-17995`: workload includes rendering and file I/O, and the exact checkout must load compiled Matplotlib components. It risks measuring rendering/backend/I/O rather than the intended Python hotspot.
- `matplotlib__matplotlib-21564`: calls `to_html5_video()`, introducing an FFmpeg/external-process dependency and a large correctness suite.

## 5. Windows validation gates

A shortlisted instance must pass all gates before it is admitted to an Agent experiment:

1. Clone the upstream repository into ignored `workspaces/`, checkout the exact `base_commit`, and record `git rev-parse HEAD`.
2. Create an isolated Windows virtual environment with a pinned Python version and lock the resolved dependencies.
3. Translate only shell syntax needed for Windows; do not change workload logic or correctness expectations.
4. Build/install the unchanged checkout. Preserve the complete command, stdout, stderr, exit code, and toolchain versions.
5. Run the unchanged guarding tests. A task with an already-failing oracle is rejected or separately adjudicated; it is not silently weakened.
6. Run the unchanged workload repeatedly in fresh processes. Record raw samples, warm-up policy, process affinity/priority if used, and environment metadata.
7. Reject tasks whose coefficient of variation or ordering is unstable under the protocol selected later.
8. Only after the baseline is accepted may profiling be enabled. Profiled runtime must never be used as the benchmark runtime.

## 6. Main risks

1. **Environment drift:** the benchmark’s gold results come from controlled Linux containers, while this study requires native Windows and historical repository commits.
2. **Oracle cost and portability:** a small workload can still have hundreds of guarding tests; some tests may contain POSIX assumptions or optional-dependency behavior.
3. **Misattributed speedup:** NumPy/BLAS, rendering, filesystem, scheduler, or interpreter effects can dominate a workload even when the expert patch touches Python code.
4. **Measurement noise:** sub-second tasks, CPU frequency scaling, background load, antivirus scanning, and first-import/cache effects can obscure modest improvements.
5. **Benchmark leakage:** the expert patch is public. It must be hidden from any future optimization Agent and used only by the evaluator for reference/validation.

## 7. Recommendation

Use SWE-fficiency as a **harness-development and pilot-task source with risks**, not as a drop-in Windows benchmark. Start by execution-validating the four SymPy candidates and `dask__dask-5501`. Keep the official expert patches outside the Agent-visible workspace. Do not run optimization until the unchanged build, correctness, and measurement baselines are preserved as raw evidence.

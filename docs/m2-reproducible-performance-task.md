# M2 Reproducible Performance Task

## Result

**M2: PASS**

One unchanged SWE-fficiency task was reproduced on native Windows with a fixed repository revision, an isolated environment, a passing correctness oracle, and repeated unprofiled workload measurements. No Coding Agent, profiler, optimization patch, or B0/B1/B2 implementation was used.

Observed on 2026-10-06.

## Selected Task

| Field | Value |
|---|---|
| Instance | `sympy__sympy-20228` |
| Repository | `sympy/sympy` |
| Repository URL | `https://github.com/sympy/sympy.git` |
| Base commit | `c237fe7f4c1a4abcfaef0e79600e26cba4ac0a6d` |
| SWE-fficiency version field | `1.7` |
| Local workspace | `workspaces/m2-sympy-20228` |
| Environment setup commit | Same as base commit |

The local checkout was created by fetching the exact commit with depth 1 and checking out detached `FETCH_HEAD`. `git rev-parse HEAD` returned the complete expected commit before execution, and `git status --short` was empty both before and after tests and benchmarks.

## Why This Task Was Selected

This was the highest-priority candidate in the existing Windows shortlist and passed the execution gates without trying another candidate.

It was preferred because:

1. SymPy at this revision is predominantly pure Python and installed without a native compiler.
2. The workload is deterministic: it parses one fixed expression rather than random data.
3. Its approximately five-second local runtime is long enough to measure more reliably than the sub-second `sympy__sympy-19270` and Dask candidates.
4. The workload is small enough for repeated fresh-process runs, unlike longer initial candidates.
5. The correctness oracle is explicit: 285 PASS_TO_PASS names are associated with eight covering test files, and FAIL_TO_PASS is empty.
6. The code remains repository-owned Python, which is suitable for later performance-reasoning experiments.

The official gold report's runtime and speedup were not used as local results. They remain evaluator-only reference metadata and were not exposed in the Agent task file.

## Source Metadata

The official dataset row was read from the `test` split of `swefficiency/swefficiency`; it was observed at dataset-server row offset 475. The row reported:

- instance ID `sympy__sympy-20228`;
- the fixed base commit above;
- rebuild command `pip install -e .`;
- upstream test command `PYTHONWARNINGS='ignore::UserWarning,ignore::SyntaxWarning' bin/test --no-subprocess --verbose`;
- 285 PASS_TO_PASS tests;
- zero FAIL_TO_PASS tests;
- eight covering test files;
- a `timeit.repeat` workload with ten samples.

The metadata source is recorded in `experiments/tasks/sympy__sympy-20228/evaluator/manifest.json`.

## Native-Windows Environment

| Item | Observed value |
|---|---|
| OS | Windows 10 build 26200 (`Windows-10-10.0.26200-SP0`) |
| Architecture/processor | Intel64 Family 6 Model 183 Stepping 1, GenuineIntel |
| Python | CPython 3.10.8, 64-bit MSC v.1933 |
| pip | 25.3 |
| SymPy | 1.7.dev, editable checkout at the fixed commit |
| mpmath | 1.4.1 |
| Profiler | Disabled |
| CPU affinity | Not pinned |
| Process priority | Default |

The virtual environment is local to the ignored task workspace:

```text
workspaces/m2-sympy-20228/.venv
```

Resolved Python dependencies were preserved in the raw environment record. The third-party checkout and virtual environment are ignored and must not be committed.

The observed runtime dependency is also pinned in `experiments/tasks/sympy__sympy-20228/evaluator/requirements-windows.txt` for subsequent clean reproductions.

## Installation

Commands used from the target workspace:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install "pip==25.3"
.\.venv\Scripts\python.exe -m pip install -r ..\..\experiments\tasks\sympy__sympy-20228\evaluator\requirements-windows.txt
.\.venv\Scripts\python.exe -m pip install -e . --no-deps
```

The editable build succeeded and installed:

```text
mpmath==1.4.1
sympy==1.7.dev0 (editable, fixed Git commit)
```

No task source file was changed by installation.

## Correctness Validation

The native-Windows translation keeps the upstream Python test runner and warning settings. It replaces POSIX environment assignment and the `bin/test` shebang invocation with Windows process environment and an explicit venv Python executable.

Executed covering files:

```text
sympy/functions/elementary/tests/test_integers.py
sympy/functions/elementary/tests/test_interface.py
sympy/functions/elementary/tests/test_complexes.py
sympy/functions/elementary/tests/test_miscellaneous.py
sympy/functions/elementary/tests/test_hyperbolic.py
sympy/functions/elementary/tests/test_piecewise.py
sympy/functions/elementary/tests/test_exponential.py
sympy/functions/elementary/tests/test_trigonometric.py
```

Observed result:

| Field | Value |
|---|---:|
| Exit code | 0 |
| Passed | 288 |
| Skipped | 7 |
| Expected failures | 8 |
| Runner elapsed time | 40.477 s |

The eight files contain a few tests beyond the dataset's 285 PASS_TO_PASS names. They were not filtered out. The line displayed as `test_sin_cos_with_infinity f` is included in the runner's eight expected failures; the overall runner result was `[OK]` with exit code 0. No test was weakened, edited, or silently discarded.

## Performance Workload

The evaluator-only workload preserves the official logic:

```python
from sympy import sympify
from sympy.core.cache import clear_cache

def setup():
    clear_cache()

def workload():
    sympify("sign(((a * b) ** 200))")
```

The official call is preserved as `timeit.repeat(workload, number=1, repeat=10, setup=setup)`. The Windows adapter only adds JSON output so individual samples can be recorded; it does not change the expression, cache setup, repeat count, or timed body.

Protocol:

- three fresh Python processes;
- ten timed samples per process;
- 30 total samples;
- one workload invocation per timed sample;
- `clear_cache()` before each timed sample;
- no discarded warm-up samples;
- no profiler;
- default Windows priority and no CPU affinity pinning;
- every sample retained.

## Runtime Results

### Per-process results

| Process | Ten-sample mean | Within-process stdev | Process wall time |
|---:|---:|---:|---:|
| 1 | 4.766425 s | 0.094873 s | 48.425 s |
| 2 | 5.022098 s | 0.318939 s | 50.989 s |
| 3 | 4.699278 s | 0.152411 s | 47.771 s |

Process-mean summary:

- mean: 4.829267 s;
- median: 4.766425 s;
- stdev: 0.170338 s;
- coefficient of variation: 3.5272%.

### All 30 timed samples

| Metric | Value |
|---|---:|
| Count | 30 |
| Mean | 4.829267 s |
| Median | 4.779872 s |
| Sample stdev | 0.248156 s |
| Minimum | 4.467341 s |
| Maximum | 5.687326 s |
| Coefficient of variation | 5.1386% |

Raw samples, process wall times, stdout, stderr, commands, and exit codes are preserved in the evidence directory. No outlier was removed; the 5.687326-second sample remains included.

## Agent/Evaluator Isolation

The task is split into two project-owned areas:

```text
experiments/tasks/sympy__sympy-20228/
├── agent/
│   └── task.md
└── evaluator/
    ├── manifest.json
    └── workload_windows.py
```

Agent-visible inputs for a future run are limited to:

- the clean target checkout at the fixed base commit;
- `agent/task.md`, containing the public problem statement.

Evaluator-only information includes:

- the performance workload implementation;
- correctness file/name metadata;
- benchmark protocol and raw results;
- official gold runtime and speedup;
- expert patch and expert-touched-file metadata.

The evaluator directory is outside the third-party target workspace. A future Pi session must use the target checkout as its working directory and must not receive evaluator paths or contents in its prompt/context. M2 did not start an Agent.

## Raw Evidence

The successful run is preserved locally at:

```text
results/raw/m2/sympy__sympy-20228/20261006T080440.869Z/
├── benchmark-1.stderr.txt
├── benchmark-1.stdout.txt
├── benchmark-2.stderr.txt
├── benchmark-2.stdout.txt
├── benchmark-3.stderr.txt
├── benchmark-3.stdout.txt
├── correctness.stderr.txt
├── correctness.stdout.txt
├── environment.json
└── summary.json
```

`results/raw/` is ignored by Git. The evidence records commands, environment, revision, protocol, exit statuses, all runtime samples, test output, and dependency versions.

## Windows Issues and Limitations

1. The official SWE-fficiency harness is POSIX/Docker-oriented. M2 translated only environment-variable assignment, path separators, and the Python entry-point invocation; task semantics were unchanged.
2. GitHub and Hugging Face downloads were slow and intermittently returned timeout/502 responses. Once fetched, local tests and benchmarks were stable enough to complete.
3. Some pip/SymPy diagnostic strings rendered the Chinese path segment as replacement characters, but imports, tests, and benchmarks completed successfully. This should remain a monitored path-encoding risk.
4. CPU affinity and priority were not pinned. The observed all-sample CV was 5.1386%; later evaluation protocol work should decide and freeze an acceptance threshold before comparing patches.
5. The local Windows runtime is not directly comparable to the official Linux/container gold runtime.

## Complete Reproduction Steps

From the research repository root in native PowerShell:

```powershell
$target = (Resolve-Path workspaces).Path + '\m2-sympy-20228'
New-Item -ItemType Directory -Path $target
git -C $target init
git -C $target remote add origin https://github.com/sympy/sympy.git
git -C $target fetch --depth 1 origin c237fe7f4c1a4abcfaef0e79600e26cba4ac0a6d
git -C $target checkout --detach FETCH_HEAD

Set-Location $target
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade "pip<26"
.\.venv\Scripts\python.exe -m pip install -e .

Set-Location D:\pp\ec\论文\llm-concurrency-detector-optimization
npm run reproduce:sympy-20228
```

The final command verifies the commit and clean worktree, runs the eight correctness files, launches three fresh benchmark processes, records every result, and fails if correctness or any benchmark process fails.

## Decision

`sympy__sympy-20228` is accepted as the first reproducible native-Windows performance task. M2 stops here as requested. This result establishes the unchanged baseline only; it does not claim an optimization result and does not begin profiling, B0, B1, B2, or context selection.

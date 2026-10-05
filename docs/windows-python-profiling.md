# Native Windows Python Profiling Options

## Purpose

This note selects profiling candidates for unchanged SWE-fficiency pilot workloads on native Windows. No profiler has been installed or used yet, and no profiler is recorded as the final study choice.

Profiling and benchmarking serve different purposes. Profiling locates work; unprofiled repeated runs measure performance. Python's own documentation explicitly warns that profilers are not benchmarking tools because profiler overhead can distort Python-versus-native-code attribution.

## Options

| Tool | Method | Native Windows | Best use here | Important limitation |
|---|---|---:|---|---|
| `cProfile` + `pstats` | Deterministic call tracing | Yes; standard library | Zero-install call counts and call-graph confirmation | Adds per-call overhead and can make native code appear relatively cheaper; weak default support for multi-process workloads. |
| `py-spy` | Out-of-process sampling | Yes; official wheels | First-pass low-overhead hotspot localization and flamegraphs | Short workloads need longer/repeated sampling; attaching to an existing process may need privileges. Launch mode is preferable. |
| Pyinstrument | In-process statistical profiler | Yes | Readable wall-clock call trees for a single workload or pytest invocation | Default 1 ms sampling can miss very short functions; wall time includes waiting/I/O. |
| Yappi | In-process tracing profiler | Yes, subject to wheel verification | Dask/thread/async follow-up; CPU and wall clocks, per-thread stats | In-process tracing changes execution and must not supply benchmark timings. |
| Scalene | Sampling/line-level CPU and memory profiler | Officially supports Windows | Separating Python and native time; targeted second-line investigation | Windows support has additional runtime prerequisites and reported multiprocessing limitations; validate on the exact workload before relying on it. |
| `line_profiler` | Targeted line tracing | Windows packages are available, exact wheel still to verify | Final inspection of one or two already-localized Python functions | High distortion and requires choosing functions in advance. |

Sources: [Python profiler documentation](https://docs.python.org/3/library/profile.html), [py-spy repository and Windows/native support table](https://github.com/benfred/py-spy), [Pyinstrument design](https://pyinstrument.readthedocs.io/en/stable/how-it-works.html), [Yappi repository](https://github.com/sumerc/yappi), and [Scalene repository](https://github.com/plasma-umass/scalene).

## Recommended staged pilot

1. **Unprofiled baseline:** run correctness tests and the fixed workload through the Harness. Preserve every raw timing sample.
2. **Primary localization:** use `py-spy record -- <python> <workload.py>` in process-launch mode. For a sub-second task, repeat the workload within the profiling-only wrapper; do not alter the benchmark workload used for scoring.
3. **Call-count confirmation:** run `python -m cProfile -o <artifact.prof> <workload.py>` and inspect with `pstats`. Compare hotspot identity, not profiler-reported runtime, with the sampling result.
4. **Concurrency-specific follow-up:** use Yappi when Dask threads/async activity makes a single main-thread profile misleading.
5. **Targeted line attribution:** use Scalene or `line_profiler` only after a function is localized and only if the Windows pilot proves stable.
6. **Native-code attribution:** try py-spy `--native` on x86-64 Windows when C/Cython/BLAS work is material and debug symbols are sufficient. Treat unresolved native frames as an attribution limitation.

## Evidence to preserve

For every profile, record:

- task ID, repository commit, workload hash, Python executable and version;
- profiler name/version and exact command;
- working directory, environment variables, start/end timestamps, exit code;
- raw profiler artifact and console output;
- whether the run was launch-mode or attach-mode;
- whether native frames, child processes, threads, or async tasks were included;
- `git diff --exit-code` before and after profiling.

Profiler artifacts belong under ignored `results/raw/` or `profiles/`; summarized findings may be versioned separately.

## Decision rule

The provisional default is `py-spy` for low-overhead localization plus `cProfile` for call-count confirmation. This becomes a research decision only after both run successfully on at least one unchanged SymPy task and one unchanged Dask task on this Windows host. If py-spy fails because of interpreter/permission constraints, Pyinstrument is the first fallback. Scalene is not the default until its exact Windows and multiprocessing behavior is verified locally.

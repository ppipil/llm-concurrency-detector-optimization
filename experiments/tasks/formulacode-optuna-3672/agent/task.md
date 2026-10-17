**Objective:**
You are a performance optimization expert. Speed up the repository **while maintaining correctness**.

**Tooling:**
The environment includes **Pytest** for testing and **Airspeed Velocity (ASV)** for benchmark measurements and profiling.

**Process:**

1. Read the code and the information below and establish a baseline with the relevant ASV benchmark.
2. Prefer a targeted ASV run using `asv run --python=same --bench="<regex>"`; do not run the full suite.
3. Make a targeted source-code change that addresses the relevant hot path while preserving correctness.
4. Run the relevant correctness test and performance workload.

**Repository Description**

This repository is `optuna/optuna`, a Python hyperparameter optimization framework.

**Task Description**

Optimize the code to run as fast as possible. Use the following initial observation if needed to understand the problem:

Unnecessary deepcopy in the Redis storage implementation adds overhead, and after its removal the test `test_get_all_trials_deepcopy_option` fails because the mocked `copy.deepcopy` is no longer called (`call_count == 0`), causing a CI failure.

Correctness takes priority over speed. Do not run the full benchmark or test suite within this calibration run.

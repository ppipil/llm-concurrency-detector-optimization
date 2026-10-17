AGENT CONTRACT
- Complete one concrete source-code performance optimization and run relevant real tests before finishing.
- Preserve correctness and public behavior. Do not modify or weaken tests, benchmarks, or test infrastructure.
- Work only inside the current repository checkout and use only the declared tools. Do not read parent directories or external project/evaluator files.
- Use the existing .venv/Scripts/python.exe for Python commands on native Windows through Git Bash.
- Do not read evaluator-only files, hidden oracle data, expert or gold patches, gold-touched files, gold speedups, or post-edit reference results.
- Do not claim success from reasoning alone; report only observed results.
- Run classification: preliminary experiment.
- Execution budget: 20 tool calls; 12 model turns; 10 minutes wall-clock.
- Bash commands receive a controller-enforced default timeout of 60 seconds.

TASK
# Performance task: sympy__sympy-20228

Repository: `sympy/sympy`  
Base commit: `c237fe7f4c1a4abcfaef0e79600e26cba4ac0a6d`

Runtime increases rapidly with the exponent for expressions such as:

```python
from sympy import sympify

a = sympify("sign(((a * b) ** 2))")
b = sympify("sign(((a * b) ** 200))")
c = sympify("sign(((a * b) ** 400))")
```

The optimization task is to improve the performance of this behavior while preserving correctness.

PERFORMANCE CONTEXT
The provided performance context is evidence for the current task, not a requirement to exhaustively analyze every item.
Use it to form a plausible optimization hypothesis.
Repeat expensive diagnostics only when needed to resolve a specific uncertainty.

(no pre-supplied performance evidence)

RUNNING / EXECUTION GUIDANCE
- Perform only the investigation needed to make a safe change.
- Once you have both a plausible bottleneck and a concrete optimization hypothesis, prioritize implementing the smallest safe patch and running targeted correctness tests.
- Do not continue profiling, reading, or searching merely to obtain complete certainty.
- Do not enlarge the formal workload's input sizes for expensive exploratory runs.
- Reserve enough execution budget for the edit and targeted test.

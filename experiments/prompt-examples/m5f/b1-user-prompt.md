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

PROFILER EVIDENCE
source=cProfile 3.10.8; ordering=mechanical descending runtime; top_k=8; profiling times include overhead and are not benchmark runtimes; evaluator and measurement-wrapper frames are filtered only for information-boundary safety.

SYMBOLS
F1 dup_mul @ sympy/polys/densearith.py:735
F2 <built-in method builtins.max> @ ~:?
F3 <built-in method builtins.min> @ ~:?
F4 dup_sqr @ sympy/polys/densearith.py:835
F5 _randbelow_with_getrandbits @ D:/pp/app/Python10/Lib/random.py:239
F6 <method 'append' of 'list' objects> @ ~:?
F7 <listcomp> @ sympy/polys/densearith.py:536
F8 shuffle @ D:/pp/app/Python10/Lib/random.py:380
F9 <built-in method builtins.exec> @ ~:?
F10 sympify @ sympy/core/sympify.py:92
F11 parse_expr @ sympy/parsing/sympy_parser.py:908
F12 <built-in method builtins.eval> @ ~:?
F13 eval_expr @ sympy/parsing/sympy_parser.py:896
F14 wrapper @ sympy/core/cache.py:69
F15 __new__ @ sympy/core/function.py:450
F16 __new__ @ sympy/core/function.py:270
F17 <module> @ <string>:1
F18 eval @ sympy/functions/elementary/complexes.py:333

SELF_TIME_TOP_8
1 F1 calls=387500 self=50.382429s share=61.36%
2 F2 calls=25064244 self=3.319769s share=4.04%
3 F3 calls=24713531 self=3.106888s share=3.78%
4 F4 calls=12340 self=2.433050s share=2.96%
5 F5 calls=4127741 self=1.993758s share=2.43%
6 F6 calls=25426656 self=1.815120s share=2.21%
7 F7 calls=269800 self=1.276059s share=1.55%
8 F8 calls=250553 self=1.255218s share=1.53%

CUMULATIVE_TIME_TOP_8
1 F9 calls=657 cumulative=82.112577s
2 F10 calls=459249 cumulative=81.080250s
3 F11 calls=10 cumulative=81.079179s
4 F12 calls=78 cumulative=81.063344s
5 F13 calls=10 cumulative=81.060312s
6 F14 calls=376112 cumulative=81.059825s
7 F15 calls=3566 cumulative=80.936808s
8 F16 calls=3566 cumulative=80.934490s

CALL_EDGES_TOP_8
1 F10>F11 calls=10 cumulative=81.079179s
2 F11>F13 calls=10 cumulative=81.060312s
3 F13>F12 calls=10 cumulative=81.060298s
4 F14>F15 calls=28 cumulative=80.936808s
5 F17>F14 calls=20 cumulative=80.935143s
6 F15>F14 calls=28 cumulative=80.934579s
7 F14>F16 calls=28 cumulative=80.934490s
8 F16>F18 calls=10 cumulative=80.933364s

RUNNING / EXECUTION GUIDANCE
- Perform only the investigation needed to make a safe change.
- Once you have both a plausible bottleneck and a concrete optimization hypothesis, prioritize implementing the smallest safe patch and running targeted correctness tests.
- Do not continue profiling, reading, or searching merely to obtain complete certainty.
- Do not enlarge the formal workload's input sizes for expensive exploratory runs.
- Reserve enough execution budget for the edit and targeted test.

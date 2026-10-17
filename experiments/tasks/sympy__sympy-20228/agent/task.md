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

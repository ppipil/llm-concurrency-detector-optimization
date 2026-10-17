"""Fixed-seed, lightweight M5d construction workload; evaluator-only."""

from __future__ import annotations

import random

from sympy.polys.domains.gaussiandomains import GaussianInteger, GaussianRational
from sympy.polys.domains.integerring import ZZ
from sympy.polys.domains.rationalfield import QQ


def setup(seed: int = 42, count: int = 10_000):
    random.seed(seed)
    integers = [(ZZ(random.randint(-1000, 1000)), ZZ(random.randint(-1000, 1000))) for _ in range(count)]
    rationals = [
        (
            QQ(random.randint(-1000, 1000), random.randint(1, 1000)),
            QQ(random.randint(-1000, 1000), random.randint(1, 1000)),
        )
        for _ in range(count)
    ]
    return integers, rationals


INTEGER_DATA, RATIONAL_DATA = setup()


def workload():
    for x, y in INTEGER_DATA:
        GaussianInteger(x, y)
    for x, y in RATIONAL_DATA:
        GaussianRational(x, y)

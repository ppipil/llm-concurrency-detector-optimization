"""Windows recording adapter for the unchanged SWE-fficiency workload logic."""

import json
import statistics
import timeit

from sympy import sympify
from sympy.core.cache import clear_cache


def setup():
    clear_cache()


def workload():
    sympify("sign(((a * b) ** 200))")


runtimes = timeit.repeat(workload, number=1, repeat=10, setup=setup)

print(
    json.dumps(
        {
            "runtimes_seconds": runtimes,
            "mean_seconds": statistics.mean(runtimes),
            "stdev_seconds": statistics.stdev(runtimes),
        }
    )
)

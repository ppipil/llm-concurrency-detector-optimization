**Objective:**
You are a performance optimization expert. Speed up the repository **while maintaining correctness**.

**Tooling:**
The micromamba environment includes **Pytest** for testing and **Airspeed Velocity (ASV)** for benchmarking measurements and profiling.

**Process:**

**1. Scan & Baseline**

- Read the code and any hints.
- Map likely bottlenecks.
- Establish a **baseline** by running the **relevant** ASV benchmarks.

**2. Benchmark (ASV)**
- Read through relevant benchmarks.
- Prefer targeted runs using `--bench=<regex>`; full-suite runs are too time-consuming and are discouraged.
- Commands:

  ```bash
  # Always pin to current interpreter
  asv run --python=same --bench="<regex>"
  ```

* Find benchmarks via `asv_benchmarks.txt` or in the directory containing the ASV benchmarks.
* You may run multiple benchmarks at once using regexes.

**3. Profile Hotspots**

* Profile **relevant** benchmarks to locate hot paths.
* Use ASV's built-in profiling support.

  ```bash
  asv profile --python=same --config=<path-to-asv.*.json> <benchmark_name>
  ```

**4. Optimize**

* Make targeted changes that address the hot paths while maintaining correctness. 
* Always follow the **Operating Principles** below.

**Operating Principles**

* **One change/command at a time** (code edit, ASV run, profiling).
* **Baseline first**, then iterate.
* **Target the hot paths** shown by profiling.
* **Evidence-driven**: justify changes with benchmark/profile data.
* **Correctness first**: never trade correctness for speed.

**Repository Description**

This repository is called HIPS/autograd. HIPS/autograd is written primarily in Python and is described as a "Efficiently computes derivatives of NumPy code.".

**Task Description**

Your main goal is to optimize the code to run as fast as possible. Use the following information if needed to understand the problem:

**Initial Observations**

Overflow warnings caused by the use of `cosh` in the tanh derivative calculation, and slower derivative evaluation due to the extra `cosh` call.

**Relevant Issues**

# Issue #312: Define ufunc JO and JTO simultaneously
Description:
### To possibly do:
- Implement derivatives for the binary ufunc methods (see https://github.com/HIPS/autograd/issues/234).

### Summary of the changes in this pr
1. New helper function `def_ufunc_jps` for defining the jvp and vjp of a ufunc in one shot. The lines
    ```python
    defjvp(anp.sin, lambda g, ans, x : g * anp.cos(x))
    defvjp(anp.sin, lambda ans, x : lambda g: g * anp.cos(x))
    ```
    can be replaced with a single line
    ```python
    #                      ('derivative'             , linear operator to apply)
    def_ufunc_jps(anp.sin, (lambda ans, x: anp.cos(x), 'mul'                   ))
    ```
    I've added a docstring to `def_ufunc_jps` explaining how to use it.
2. All numpy and scipy ufuncs and ufunc-like functions to the new format enabling forward mode for many scipy primitives. Enable forward mode tests for newly supported primitives.
3. Make `broadcast_to` into a primitive, define its adjoint in numpy_wrapper.py and setup derivatives. This is roughly the same as #292.
4. New helper function `def_ufunc_jps_inv_pair` for defining the jps of an inverse pair of ufuncs in one shot. So for example the four defs
    ```python
    defvjp(anp.square,  lambda ans, x : lambda g: g * 2 * x)		
    defvjp(anp.sqrt,    lambda ans, x : lambda g: g * 0.5 * x**-0.5)

    defjvp(anp.square,      lambda g, ans, x : g * 2 * x)		
    defjvp(anp.sqrt,        lambda g, ans, x : g * 0.5 * x**-0.5)
    ```
    become
    ```python
    def_ufunc_jps_inv_pair(anp.square, anp.sqrt, lambda ans, x: 2 * x)
    ```
    Implement this for the 10 or so inverse pairs I spotted. This could also make implementing the grads of inverse cdf functions (which exist for most scipy.stats distributions) very straightforward.
5. Move `match_complex`, `unbroadcast` and `unbroadcast_f` into newly created `autograd.numpy.util` alongside the new helper functions (I think this rearrangement makes sense).
6. (Bonus) I've added the derivatives and tests for [`scipy.special.rel_entr`](https://docs.scipy.org/doc/scipy/reference/generated/scipy.special.rel_entr.html). 

### Notes
We could reduce the number of lines of code for other primitive defs in this way. In particular I've got my eye on the reductions (sum, mean, var, std) to potentially do next. I also think, at least in the case of ufuncs, that this style is clearer. I guess we'd better check that there's little or no harm to performance. I think any overhead introduced could potentially be optimized away by carefully handling different special cases in [def_ufunc_jps](https://github.com/j-towns/autograd/blob/fwd-rev-in-one-def/autograd/numpy/util.py#L26..L72).

During higher order derivatives, the computation of what I've called `'derivative'` in the snippet above could be cached and reused. This computation is currently being re-done, because the same primitive's jvp/vjp is being called at each layer of unboxing, with numerically the same ans and *args inputs (although g will be different for each layer). I might write a little blog post about this as I suspect this is an optimization that may not yet be implemented in e.g. Theano or Tensorflow. Implementing this in Autograd might require something similar to what was discussed in #188.





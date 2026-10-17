# Performance task: sympy__sympy-21391

Repository: `sympy/sympy`  
Base commit: `8ddf9c29e345df987e82f8c5905dd0b32ea0a4b6`

Creating many `GaussianInteger` and `GaussianRational` domain elements has measurable runtime overhead.

Improve this construction performance with one concrete source optimization while preserving public behavior and correctness. Run the most relevant targeted correctness tests after editing.

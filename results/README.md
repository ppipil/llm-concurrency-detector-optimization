# Results

This directory holds evidence indexes and small, reviewable summaries derived from real execution.

Future run records should identify:

- task and immutable repository revision;
- B0/B1/B2/B3 group and run identifier;
- correctness outcome;
- raw benchmark samples and calculated speedup;
- profiler artifact references and normalized performance evidence;
- patch/diff hash and outcome classification;
- iterations, tool calls, token usage, and wall-clock time;
- commands, environment metadata, and checksums for external raw artifacts.

Large stdout/stderr logs, profiler captures, and other raw data belong under ignored `results/raw/`. M3 evaluator runs use `results/raw/evaluations/<task>/<run-id>/`, containing machine-readable `evaluation.json`, human-readable `summary.md`, and per-command logs. Summaries must link to preserved evidence and must never replace missing execution with inferred values.

M4 runs use `results/raw/profiles/<task>/<run-id>/`. Each capture keeps the raw `.prof`, textual pstats views, workload logs, normalized `evidence.json`, and `summary.md`. Profiler timings are never benchmark timings.

M5 preliminary Agent runs use `results/raw/m5/<experiment-id>/<group>/`, with exact prompts, complete trajectories, transcripts, usage, patches, and nested M3 evaluation evidence. The experiment root contains a machine-readable aggregate and human summary.

M5b keeps per-Agent evidence under the same M5 layout and stores its cross-run aggregate under `results/raw/m5b/<run-name>/`. A cross-run aggregate must retain the exact source evidence directories and must not turn an empty-patch timing change into an optimization claim.

M5c protocol-validation evidence uses `results/raw/m5c/<experiment-id>/`. If no source patch is produced, the record must say `NO_PATCH`; the unchanged checkout is not benchmarked merely to manufacture an optimization outcome.

M5d development evidence uses `results/raw/m5d/<experiment-id>/`. Its profiler and three-to-five-sample timings are sanity evidence only and must not be merged into formal M3 results.

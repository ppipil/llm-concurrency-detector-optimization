# Baseline profiler summary

- Task: `optuna_optuna_5993`
- Revision: `d763594b1c081695e1fd14283210802521b59649`
- Profiler: CPython `cProfile` 3.10.8
- Status: `PASS`; source checkout unchanged
- Measurement purpose: profiling only; not eligible for speedup calculation
- Profiler wall time: 0.577 seconds
- Functions / call relationships: 149 / 208

The dominant repository-owned self-time frame was the WAITING-state filtering list comprehension at `optuna/storages/_in_memory.py:380`: 500 calls, 0.198715 seconds self time, and 65.39% self share. `_pop_waiting_trial_id` at `optuna/study/study.py:1058` accumulated 0.214291 seconds over 500 calls, of which 0.201717 seconds flowed through `InMemoryStorage.get_all_trials`.

B1 rendered a 1,810-character mechanical Top-8 context containing the relevant pop, storage-filter, and state-update frames. B2 consumed the same baseline evidence and selected `_pop_waiting_trial_id` plus the high-frequency `FrozenTrial.number` property in 1,776 characters under the same ceiling. The second target and B2's artifact-test associations are mechanically produced but weakly task-specific; this limitation is retained rather than manually correcting the selector output.

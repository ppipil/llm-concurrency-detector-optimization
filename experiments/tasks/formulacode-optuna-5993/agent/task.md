# Performance Optimization Task

Repository: `optuna/optuna`

Base commit: `d763594b1c081695e1fd14283210802521b59649`

Optimize repository performance while preserving correctness and public behavior.

## Initial observations

`Study._pop_waiting_trial_id()` is slow with `InMemoryStorage` when a study has many existing non-waiting trials. The fixed workload repeatedly retrieves one waiting trial located after 10,000 non-waiting trials and resets that trial to `WAITING` between retrievals.

## Validation

Use the supplied fixed waiting-trial benchmark and targeted tests for measured validation. Preserve waiting-trial retrieval order, state transitions, and study-deletion behavior. Do not modify or weaken tests or benchmark definitions.

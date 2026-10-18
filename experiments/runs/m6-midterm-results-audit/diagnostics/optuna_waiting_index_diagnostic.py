"""Independent diagnostic checks for the Optuna waiting-trial index patches.

This is an audit-only probe. It is not part of the frozen evaluator and must not
be used to overwrite the historical calibration outcomes.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import pickle

import optuna
from optuna.storages import InMemoryStorage
from optuna.trial import TrialState


def _run_check(check):
    try:
        details = check()
        return {"status": "PASS", "details": details}
    except Exception as error:  # Preserve the observed failure as audit evidence.
        return {
            "status": "FAIL",
            "error_type": type(error).__name__,
            "error": str(error),
        }


def check_waiting_order() -> dict[str, int]:
    storage = InMemoryStorage()
    study = optuna.create_study(storage=storage)
    first = study.ask()
    second = study.ask()

    # Re-enter WAITING in reverse trial-number order. The unmodified storage
    # filters its canonical trial list and therefore returns the lower number.
    assert storage.set_trial_state_values(second._trial_id, TrialState.WAITING)
    assert storage.set_trial_state_values(first._trial_id, TrialState.WAITING)
    popped_id = study._pop_waiting_trial_id()
    assert popped_id == first._trial_id, (
        f"expected trial id {first._trial_id} (number {first.number}) first, "
        f"but popped {popped_id}"
    )
    return {
        "expected_trial_id": first._trial_id,
        "second_trial_id": second._trial_id,
        "popped_trial_id": popped_id,
    }


def check_legacy_pickle() -> dict[str, object]:
    storage = InMemoryStorage()
    study = optuna.create_study(storage=storage)
    waiting = study.ask()
    assert storage.set_trial_state_values(waiting._trial_id, TrialState.WAITING)

    study_info = storage._studies[study._study_id]
    removed_fields: list[str] = []
    for field in ("waiting_trial_ids", "waiting_trial_numbers"):
        if hasattr(study_info, field):
            delattr(study_info, field)
            removed_fields.append(field)

    restored = pickle.loads(pickle.dumps(storage))
    restored_waiting = restored.get_all_trials(
        study._study_id,
        deepcopy=False,
        states=(TrialState.WAITING,),
    )
    restored_ids = [trial._trial_id for trial in restored_waiting]
    assert restored_ids == [waiting._trial_id], (
        f"expected restored waiting ids {[waiting._trial_id]}, got {restored_ids}"
    )
    return {
        "simulated_removed_fields": removed_fields,
        "expected_waiting_ids": [waiting._trial_id],
        "restored_waiting_ids": restored_ids,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--label", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    result = {
        "schema_version": 1,
        "classification": "independent audit diagnostic; not frozen evaluator output",
        "label": args.label,
        "optuna_version": optuna.__version__,
        "checks": {
            "waiting_order_after_reverse_transition": _run_check(check_waiting_order),
            "legacy_pickle_with_existing_waiting_trial": _run_check(check_legacy_pickle),
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Evaluator-only state-consistency checks for the Optuna waiting-trial task."""

from __future__ import annotations

import pytest

import optuna
from optuna.study import StudyDirection
from optuna.trial import TrialState


def create_waiting_trial(storage: optuna.storages.InMemoryStorage, study_id: int) -> int:
    trial_id = storage.create_new_trial(study_id)
    assert storage.set_trial_state_values(trial_id, TrialState.WAITING)
    return trial_id


def test_waiting_trials_are_popped_in_order_and_marked_running() -> None:
    storage = optuna.storages.InMemoryStorage()
    study = optuna.create_study(storage=storage)
    waiting = [create_waiting_trial(storage, study._study_id) for _ in range(3)]

    popped = [study._pop_waiting_trial_id() for _ in waiting]

    assert popped == waiting
    assert [storage.get_trial(trial_id).state for trial_id in waiting] == [
        TrialState.RUNNING,
        TrialState.RUNNING,
        TrialState.RUNNING,
    ]
    assert study._pop_waiting_trial_id() is None


def test_waiting_state_update_makes_trial_available_again() -> None:
    storage = optuna.storages.InMemoryStorage()
    study = optuna.create_study(storage=storage)
    trial_id = create_waiting_trial(storage, study._study_id)

    assert study._pop_waiting_trial_id() == trial_id
    assert storage.get_trial(trial_id).state == TrialState.RUNNING
    assert storage.set_trial_state_values(trial_id, TrialState.WAITING)
    assert study._pop_waiting_trial_id() == trial_id
    assert storage.get_trial(trial_id).state == TrialState.RUNNING


def test_deleting_study_discards_waiting_trial_state() -> None:
    storage = optuna.storages.InMemoryStorage()
    deleted_study_id = storage.create_new_study([StudyDirection.MINIMIZE], "deleted")
    deleted_trial_id = create_waiting_trial(storage, deleted_study_id)

    storage.delete_study(deleted_study_id)

    with pytest.raises(KeyError):
        storage.get_trial(deleted_trial_id)
    replacement = optuna.create_study(storage=storage, study_name="replacement")
    assert replacement._pop_waiting_trial_id() is None
    replacement_trial_id = create_waiting_trial(storage, replacement._study_id)
    assert replacement._pop_waiting_trial_id() == replacement_trial_id

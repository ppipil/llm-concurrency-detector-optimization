"""Evaluator-only semantic checks for the NetworkX rescale_layout task."""

from __future__ import annotations

import numpy as np
import pytest

from networkx.drawing.layout import rescale_layout


def reference_rescale(position: np.ndarray, scale: float) -> np.ndarray:
    expected = position.copy()
    for axis in range(expected.shape[1]):
        expected[:, axis] -= expected[:, axis].mean()
    limit = np.abs(expected).max()
    if limit > 0:
        expected *= scale / limit
    return expected


@pytest.mark.parametrize("dimensions", [1, 2, 3, 7])
def test_rescale_matches_reference_for_multiple_dimensions(dimensions: int) -> None:
    source = np.arange(11 * dimensions, dtype=float).reshape(11, dimensions)
    expected = reference_rescale(source, scale=2.5)
    result = rescale_layout(source.copy(), scale=2.5)
    np.testing.assert_allclose(result, expected)


def test_rescale_mutates_and_returns_input_array() -> None:
    source = np.array([[1.0, 4.0], [3.0, 8.0]])
    result = rescale_layout(source, scale=1.0)
    assert result is source
    np.testing.assert_allclose(source.sum(axis=0), 0.0, atol=1e-12)


def test_zero_extent_input_remains_finite_and_unchanged() -> None:
    source = np.zeros((5, 3), dtype=float)
    result = rescale_layout(source, scale=4.0)
    np.testing.assert_array_equal(result, np.zeros((5, 3)))
    assert np.isfinite(result).all()

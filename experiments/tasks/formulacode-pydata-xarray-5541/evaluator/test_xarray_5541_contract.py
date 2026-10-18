"""Evaluator-only semantic checks for the xarray transpose performance task."""

from __future__ import annotations

import numpy as np
import pytest

from xarray import Variable


def test_one_dimensional_transpose_preserves_shallow_copy_semantics() -> None:
    source = Variable(("x",), np.arange(5.0), attrs={"unit": "m"})
    result = source.transpose()

    assert result is not source
    assert result.dims == source.dims
    assert result.attrs == source.attrs
    assert np.shares_memory(result.data, source.data)
    np.testing.assert_array_equal(result.data, source.data)


def test_zero_dimensional_transpose_preserves_value_and_dimensions() -> None:
    source = Variable((), 3.5)
    result = source.transpose()

    assert result is not source
    assert result.dims == ()
    assert result.item() == 3.5


def test_same_order_and_reordered_multidimensional_transpose() -> None:
    values = np.arange(24).reshape(2, 3, 4)
    source = Variable(("x", "y", "z"), values)

    same_order = source.transpose("x", "y", "z")
    reordered = source.transpose("z", ..., "x")

    assert same_order is not source
    np.testing.assert_array_equal(same_order.data, values)
    assert reordered.dims == ("z", "y", "x")
    np.testing.assert_array_equal(reordered.data, values.transpose(2, 1, 0))


@pytest.mark.parametrize(
    "dims",
    [
        ("missing",),
        ("x", "x"),
        ("x",),
    ],
)
def test_invalid_transpose_dimensions_still_raise(dims: tuple[str, ...]) -> None:
    source = Variable(("x", "y"), np.arange(6).reshape(2, 3))

    with pytest.raises(ValueError):
        source.transpose(*dims)

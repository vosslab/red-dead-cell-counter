"""Protect the adaptive blob experiment's measured behavior contracts."""

import pathlib
import sys

import numpy
import pytest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "devel"))

import adaptive_blob_scoring as scoring
import benchmark_adaptive_blobs


def test_baseline_includes_exact_float32_cutoff_maxima() -> None:
	response = numpy.zeros((30, 30), dtype=numpy.float32)
	response[2, 2] = numpy.float32(0.08)
	response[12, 12] = numpy.float32(0.1)
	response[22, 22] = numpy.float32(0.12)
	choices = benchmark_adaptive_blobs.baseline_choices(response)

	assert choices[0.08].tolist() == [[22, 22], [12, 12], [2, 2]]
	assert choices[0.1].tolist() == [[22, 22], [12, 12]]
	assert choices[0.12].tolist() == [[22, 22]]


def test_uncertainty_interval_and_outside_loss() -> None:
	inside_lower = scoring.score_count(900, 990)
	inside_upper = scoring.score_count(1100, 990)
	below = scoring.score_count(80, 100)
	above = scoring.score_count(125, 100)

	assert inside_lower["in_band"] is True
	assert inside_upper["in_band"] is True
	assert inside_lower["outside_loss"] == 0
	assert inside_upper["outside_loss"] == 0
	assert below["signed_outside_error"] < 0
	assert above["signed_outside_error"] > 0
	assert below["outside_loss"] == pytest.approx(1 / 1.1 - 0.8)
	assert above["outside_loss"] == pytest.approx(1.25 - 1 / 0.9)

"""Score image counts against uncertain human reference totals."""

import math


def _validate_count(count: int, reference: int) -> None:
	"""Reject invalid counts and references before scoring."""
	if isinstance(count, bool) or not isinstance(count, int) or count < 0:
		raise ValueError("count must be a nonnegative integer")
	if isinstance(reference, bool) or not isinstance(reference, int) or reference <= 0:
		raise ValueError("reference must be a positive integer")
	try:
		finite_count = math.isfinite(float(count))
		finite_reference = math.isfinite(float(reference))
	except OverflowError:
		finite_count = False
		finite_reference = False
	if not finite_count or not finite_reference:
		raise ValueError("count and reference must be finite")


def score_count(count: int, reference: int) -> dict[str, int | float | bool]:
	"""Score one count against the reference's implied +/-10% interval.

	Args:
		count: Nonnegative integer algorithm count.
		reference: Positive integer human total.

	Returns:
		Count, reference interval, band membership, normalized outside error/loss,
		and descriptive exact-point percentage error.
	"""
	_validate_count(count, reference)
	lower = reference / 1.10
	upper = reference / 0.90
	in_band = lower <= count <= upper
	if count < lower:
		signed_outside_error = (count - lower) / reference
	elif count > upper:
		signed_outside_error = (count - upper) / reference
	else:
		signed_outside_error = 0.0
	outside_loss = abs(signed_outside_error)
	point_error = (count - reference) / reference * 100
	row = {
		"count": count,
		"reference": reference,
		"lower": lower,
		"upper": upper,
		"in_band": in_band,
		"signed_outside_error": signed_outside_error,
		"outside_loss": outside_loss,
		"point_error": point_error,
	}
	return row


def summarize(rows: list[dict]) -> dict[str, float | int]:
	"""Summarize outside loss and in-band counts across images."""
	if not rows:
		raise ValueError("at least one image row is required")
	losses = [row["outside_loss"] for row in rows]
	if any(not math.isfinite(loss) or loss < 0 for loss in losses):
		raise ValueError("outside_loss values must be finite and nonnegative")
	mean_loss = sum(losses) / len(losses)
	worst_loss = max(losses)
	in_band_count = sum(row["in_band"] for row in rows)
	result = {
		"mean_loss": mean_loss,
		"worst_loss": worst_loss,
		"in_band_count": in_band_count,
	}
	return result


def _rows_by_image(rows: list[dict]) -> dict[str, dict]:
	"""Index rows by exact image id and reject ambiguous inputs."""
	indexed = {}
	for row in rows:
		if "image" not in row:
			raise ValueError("image id is required")
		image = row["image"]
		if not isinstance(image, str) or not image:
			raise ValueError("image ids must be nonempty strings")
		if image in indexed:
			raise ValueError(f"duplicate image id: {image}")
		indexed[image] = row
	return indexed


def _same_images(candidate: dict[str, dict], baseline: dict[str, dict]) -> None:
	"""Require candidate and baseline rows to cover the same images."""
	if candidate.keys() != baseline.keys():
		raise ValueError("candidate and baseline image ids must match")
	for image in candidate:
		if candidate[image]["reference"] != baseline[image]["reference"]:
			raise ValueError(f"reference count differs for image: {image}")


def assess_candidate(
	candidate: list[dict],
	baseline: list[dict],
	sensitivity_pairs: list[tuple[list[dict], list[dict]]],
) -> dict[str, bool | list[str] | int]:
	"""Apply the fixed retention rule to candidate and baseline image rows.

	Each sensitivity pair contains candidate rows followed by its baseline rows.
	"""
	candidate_by_image = _rows_by_image(candidate)
	baseline_by_image = _rows_by_image(baseline)
	_same_images(candidate_by_image, baseline_by_image)
	if len(candidate_by_image) != 8:
		raise ValueError("candidate and baseline must contain the same eight images")
	if len(sensitivity_pairs) != 2:
		raise ValueError("exactly two sensitivity pairs are required")
	candidate_summary = summarize(candidate)
	baseline_summary = summarize(baseline)
	reasons = []
	tolerance = 1e-12
	if candidate_summary["mean_loss"] >= baseline_summary["mean_loss"] - tolerance:
		reasons.append("mean loss is not strictly lower than baseline")
	improved_images = sum(
		baseline_by_image[image]["outside_loss"]
		- candidate_by_image[image]["outside_loss"] > tolerance
		for image in baseline_by_image
		if not baseline_by_image[image]["in_band"]
	)
	if improved_images < 2:
		reasons.append("fewer than two previously out-of-band images improve")
	for image, baseline_row in baseline_by_image.items():
		if baseline_row["in_band"] and not candidate_by_image[image]["in_band"]:
			reasons.append(f"previously in-band image leaves band: {image}")
	if candidate_summary["worst_loss"] > baseline_summary["worst_loss"] + tolerance:
		reasons.append("worst loss increases")
	for index, (sensitivity_candidate, sensitivity_baseline) in enumerate(
		sensitivity_pairs
	):
		sensitivity_candidate_by_image = _rows_by_image(sensitivity_candidate)
		sensitivity_baseline_by_image = _rows_by_image(sensitivity_baseline)
		_same_images(sensitivity_candidate_by_image, candidate_by_image)
		_same_images(sensitivity_baseline_by_image, baseline_by_image)
		candidate_sensitivity_summary = summarize(sensitivity_candidate)
		baseline_sensitivity_summary = summarize(sensitivity_baseline)
		if candidate_sensitivity_summary["mean_loss"] > (
			baseline_sensitivity_summary["mean_loss"] + tolerance
		):
			reasons.append(f"sensitivity pair {index + 1} mean loss increases")
	result = {
		"retain": not reasons,
		"reasons": reasons,
		"improved_images": improved_images,
	}
	return result

#!/usr/bin/env python3
"""Measure DoG threshold-mask blobs and the production detector's centers."""

from __future__ import annotations

import argparse
import csv
import json
import math
import subprocess
from pathlib import Path

import numpy as np
from scipy import ndimage

import benchmark_thresholds


ROOT = benchmark_thresholds.ROOT
THRESHOLDS = (0.05, 0.1, 0.2)
CONNECTIVITY = np.ones((3, 3), dtype=np.uint8)
CROPS = {
	"H501.jpg": ((513, 2299, 555, 2323), (1900, 1900, 2200, 2200)),
	"A501.jpg": ((3670, 3314, 3706, 3338),),
	"F201.jpg": ((2301, 3904, 2338, 3931),),
}


def perimeter(mask: np.ndarray) -> float:
	"""Match Appion's four-neighbor perimeter with its diagonal correction."""
	result = 0.0
	for y, x in np.argwhere(mask):
		neighbors = sum(
			0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny, nx]
			for ny, nx in ((y - 1, x), (y, x - 1), (y + 1, x), (y, x + 1))
		)
		result += math.sqrt(2.0) if 4 - neighbors == 2 else 4 - neighbors
	return result


def shape(mask: np.ndarray) -> tuple[float, float | None]:
	"""Return Appion-style compactness and a translation-invariant mask inertia ratio."""
	area = int(mask.sum())
	boundary = perimeter(mask)
	compactness = 4.0 * math.pi * area / (boundary * boundary)
	points = np.argwhere(mask).astype(np.float64)
	centered = points - points.mean(axis=0)
	eigenvalues = np.linalg.eigvalsh(centered.T @ centered / area)
	if eigenvalues[0] <= 0.0:
		return compactness, None
	return compactness, float(eigenvalues[1] / eigenvalues[0])


def safe_csv_cell(value: str) -> str:
	"""Prefix spreadsheet formula-leading values at the CSV output boundary."""
	# ASVS 1.2.10: prevent CSV and spreadsheet formula injection.
	return f"'{value}" if value.startswith(("=", "+", "-", "@", "\t", "\0")) else value


def blob_rows(response: np.ndarray, centers: np.ndarray, threshold: float) -> list[dict[str, float | int | None]]:
	"""Return 8-connected mask areas and baseline DoG-center memberships."""
	labels, blob_count = ndimage.label(response >= threshold, structure=CONNECTIVITY)
	areas = np.bincount(labels.ravel(), minlength=blob_count + 1)
	objects = ndimage.find_objects(labels)
	peaks = np.zeros(blob_count + 1, dtype=np.int32)
	if threshold == 0.1:
		for x, y in centers:
			label = labels[y, x]
			if label == 0:
				raise RuntimeError("production center is outside its 0.1 threshold mask")
			peaks[label] += 1
	rows = []
	for label in range(1, blob_count + 1):
		area = int(areas[label])
		compactness, inertia_ratio = (None, None)
		if threshold == 0.1:
			bounds = objects[label - 1]
			if bounds is None:
				raise RuntimeError("missing bounds for labeled blob")
			compactness, inertia_ratio = shape(labels[bounds] == label)
		rows.append(
			{
				"threshold": threshold,
				"blob_id": label,
				"area_px": area,
				"equivalent_diameter_px": 2.0 * math.sqrt(area / math.pi),
				"baseline_centers": int(peaks[label]),
				"roundness": compactness,
				"inertia_ratio": inertia_ratio,
			}
		)
	return rows


def quantile(values: list[float], percentile: float) -> float | None:
	"""Return a percentile only when the requested blob group exists."""
	if not values:
		return None
	result = float(np.percentile(values, percentile))
	return result


def summarize(image: str, centers: np.ndarray, rows: list[dict[str, float | int | None]]) -> dict[str, object]:
	"""Summarize all masks, retaining center memberships only at the baseline cutoff."""
	result: dict[str, object] = {"image": image, "baseline_centers": len(centers), "thresholds": {}}
	for threshold in THRESHOLDS:
		current = [row for row in rows if row["threshold"] == threshold]
		areas = [float(row["area_px"]) for row in current]
		entry: dict[str, object] = {
			"binary_blob_count": len(current),
			"total_mask_area_px": sum(areas),
			"median_blob_area_px": quantile(areas, 50),
		}
		if threshold == 0.1:
			single = [float(row["area_px"]) for row in current if row["baseline_centers"] == 1]
			multiple = [float(row["area_px"]) for row in current if row["baseline_centers"] >= 2]
			entry["blobs_with_multiple_centers"] = len(multiple)
			entry["centers_inside_multi_center_blobs"] = sum(
				int(row["baseline_centers"]) for row in current if row["baseline_centers"] >= 2
			)
			entry["single_center_blob_median_area_px"] = quantile(single, 50)
			entry["multi_center_blob_median_area_px"] = quantile(multiple, 50)
			for name in ("roundness", "inertia_ratio"):
				single_values = [float(row[name]) for row in current if row["baseline_centers"] == 1 and row[name] is not None]
				multiple_values = [float(row[name]) for row in current if row["baseline_centers"] >= 2 and row[name] is not None]
				entry[f"single_center_{name}_median"] = quantile(single_values, 50)
				entry[f"multi_center_{name}_median"] = quantile(multiple_values, 50)
				entry[f"single_center_{name}_n"] = len(single_values)
				entry[f"multi_center_{name}_n"] = len(multiple_values)
		result["thresholds"][f"{threshold:.2f}"] = entry
	return result


def crop_summary(response: np.ndarray, centers: np.ndarray, crop: tuple[int, int, int, int]) -> dict[str, object]:
	"""Describe a documented difficult region without assigning biological truth."""
	left, top, right, bottom = crop
	inside = centers[(centers[:, 0] >= left) & (centers[:, 0] < right) & (centers[:, 1] >= top) & (centers[:, 1] < bottom)]
	local_centers = inside - np.array([left, top], dtype=np.int32)
	rows = blob_rows(response[top:bottom, left:right], local_centers, 0.1)
	largest = max(rows, key=lambda row: int(row["area_px"]), default=None)
	return {
		"crop": {"left": left, "top": top, "right": right, "bottom": bottom},
		"baseline_centers": len(inside),
		"binary_blobs": len(rows),
		"multi_center_blobs": sum(1 for row in rows if row["baseline_centers"] >= 2),
		"largest_blob_area_px": int(largest["area_px"]) if largest else 0,
		"largest_blob_roundness": largest["roundness"] if largest else None,
		"largest_blob_inertia_ratio": largest["inertia_ratio"] if largest else None,
	}


def self_check() -> None:
	"""Check mask geometry, including shape invariance and elongated-blob response."""
	response = np.zeros((2, 2), dtype=np.float32)
	response[0, 0] = response[1, 1] = 0.1
	rows = blob_rows(response, np.array([[0, 0], [1, 1]], dtype=np.int32), 0.1)
	expected_diameter = 2.0 * math.sqrt(2.0 / math.pi)
	if len(rows) != 1 or rows[0]["area_px"] != 2 or rows[0]["baseline_centers"] != 2:
		raise RuntimeError("8-connected blob area or center-membership check failed")
	if abs(float(rows[0]["equivalent_diameter_px"]) - expected_diameter) > 1e-12:
		raise RuntimeError("equivalent-diameter check failed")
	compact = np.array([[1, 1, 1], [1, 1, 1], [1, 1, 1]], dtype=bool)
	elongated = np.ones((3, 9), dtype=bool)
	compactness, compact_ratio = shape(compact)
	elongated_compactness, elongated_ratio = shape(elongated)
	shifted = np.pad(compact, ((2, 0), (4, 0)))
	shifted_compactness, shifted_ratio = shape(shifted)
	if compact_ratio is None or elongated_ratio is None or not elongated_ratio > compact_ratio:
		raise RuntimeError("inertia-ratio shape check failed")
	if not compactness > elongated_compactness:
		raise RuntimeError("roundness shape check failed")
	if abs(compactness - shifted_compactness) > 1e-12 or abs(compact_ratio - shifted_ratio) > 1e-12:
		raise RuntimeError("binary-shape translation-invariance check failed")
	if safe_csv_cell("normal-image.jpg") != "normal-image.jpg":
		raise RuntimeError("normal CSV filename check failed")
	if any(safe_csv_cell(value) != f"'{value}" for value in ("=1+1.jpg", "+name.jpg", "-name.jpg", "@name.jpg", "\tname.jpg", "\0name.jpg")):
		raise RuntimeError("formula-leading CSV filename check failed")


def main() -> None:
	"""Run native DoG measurements for actual JPEGs and write inspectable summaries."""
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("--images", type=Path, default=ROOT / "IMAGES")
	parser.add_argument("--output", type=Path, default=ROOT / "generated" / "blob_area_experiment")
	args = parser.parse_args()
	args.output.mkdir(parents=True, exist_ok=True)
	self_check()
	subprocess.run(
		["cargo", "build", "--quiet", "--release", "--manifest-path", "rust/Cargo.toml", "--example", "threshold_probe"],
		cwd=ROOT,
		check=True,
	)
	all_rows: list[dict[str, object]] = []
	summaries = []
	for image in sorted(args.images.glob("*.jpg")):
		response, centers = benchmark_thresholds.run_probe(image, args.output)
		current_rows: list[dict[str, object]] = []
		for threshold in THRESHOLDS:
			for row in blob_rows(response, centers, threshold):
				current_rows.append({"image": safe_csv_cell(image.name), **row})
		all_rows.extend(current_rows)
		summary = summarize(image.name, centers, current_rows)
		summary["documented_crops"] = [crop_summary(response, centers, crop) for crop in CROPS.get(image.name, ())]
		summaries.append(summary)
	with (args.output / "blob_areas.csv").open("w", newline="") as handle:
		writer = csv.DictWriter(handle, fieldnames=["image", "threshold", "blob_id", "area_px", "equivalent_diameter_px", "baseline_centers", "roundness", "inertia_ratio"])
		writer.writeheader()
		writer.writerows(all_rows)
	(args.output / "summary.json").write_text(json.dumps(summaries, indent=2) + "\n")
	for summary in summaries:
		baseline = summary["thresholds"]["0.10"]
		print(
			f"{summary['image']}: {summary['baseline_centers']} centers; "
			f"{baseline['binary_blob_count']} blobs; "
			f"{baseline['blobs_with_multiple_centers']} multi-center blobs"
		)


if __name__ == "__main__":
	main()

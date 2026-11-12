#!/usr/bin/env python3
"""Compare native Rust blob features with Python on every real DoG mask."""

from __future__ import annotations

import json
import math
import subprocess
import time

import numpy as np
from scipy import ndimage

import benchmark_thresholds
import measure_blob_areas


ROOT = benchmark_thresholds.ROOT
OUTPUT = ROOT / "generated" / "blob_feature_parity"
THRESHOLD = 0.1
CONNECTIVITY = np.ones((3, 3), dtype=np.uint8)
STRIDE = 8


def expected_features(response: np.ndarray) -> list[float]:
	"""Return the documented flat Rust/Wasm feature contract for one response map."""
	labels, count = ndimage.label(response >= THRESHOLD, structure=CONNECTIVITY)
	objects = ndimage.find_objects(labels)
	features: list[tuple[int, list[float]]] = []
	for label, bounds in enumerate(objects, start=1):
		if bounds is None:
			raise RuntimeError("missing component bounds")
		mask = labels[bounds] == label
		points = np.argwhere(mask)
		first_y, first_x = points[0]
		first_x += bounds[1].start
		first_y += bounds[0].start
		area = int(mask.sum())
		roundness, inertia_ratio = measure_blob_areas.shape(mask)
		centroid_y, centroid_x = points.mean(axis=0)
		features.append(
			(
				int(first_y) * response.shape[1] + int(first_x),
				[
					float(first_x),
					float(first_y),
					float(area),
					float(centroid_x + bounds[1].start),
					float(centroid_y + bounds[0].start),
					2.0 * math.sqrt(area / math.pi),
					roundness,
					float("nan") if inertia_ratio is None else inertia_ratio,
				],
			)
		)
	if count != len(features):
		raise RuntimeError("component count does not match feature count")
	return [value for _, feature in sorted(features) for value in feature]


def compare(expected: list[float], actual: np.ndarray, image: str) -> None:
	"""Check native features against the exact/disclosed Python tolerance contract."""
	if actual.size != len(expected):
		raise RuntimeError(f"{image}: expected {len(expected)} values, got {actual.size}")
	for index, (left, right) in enumerate(zip(expected, actual, strict=True)):
		field = index % STRIDE
		if math.isnan(left):
			if not math.isnan(right):
				raise RuntimeError(f"{image}: feature {index} expected NaN")
			continue
		if field in (0, 1, 2):
			if left != right:
				raise RuntimeError(f"{image}: exact feature {index} differs: {left} != {right}")
		elif field in (3, 4):
			if abs(left - right) > 1e-7:
				raise RuntimeError(f"{image}: centroid feature {index} differs: {left} != {right}")
		elif field in (5, 6) and not math.isclose(left, right, rel_tol=1e-8, abs_tol=1e-10):
			raise RuntimeError(f"{image}: feature {index} differs: {left} != {right}")
		elif field == 7 and not math.isclose(left, right, rel_tol=1e-6, abs_tol=1e-10):
			raise RuntimeError(f"{image}: feature {index} differs: {left} != {right}")


def json_features(features: list[float]) -> list[float | None]:
	"""Encode non-finite values for JSON without changing the binary oracle."""
	return [value if math.isfinite(value) else None for value in features]


def main() -> None:
	"""Write temporary real masks and compare every native result to Python."""
	measure_blob_areas.self_check()
	OUTPUT.mkdir(parents=True, exist_ok=True)
	subprocess.run(
		["cargo", "build", "--quiet", "--release", "--manifest-path", "rust/Cargo.toml", "--example", "blob_features_probe"],
		cwd=ROOT,
		check=True,
	)
	subprocess.run(
		["cargo", "build", "--quiet", "--release", "--manifest-path", "rust/Cargo.toml", "--example", "threshold_probe"],
		cwd=ROOT,
		check=True,
	)
	probe = ROOT / "rust" / "target" / "release" / "examples" / "blob_features_probe"
	results: dict[str, dict[str, object]] = {}
	for image in sorted((ROOT / "IMAGES").glob("*.jpg")):
		response, _ = benchmark_thresholds.run_probe(image, OUTPUT)
		height, width = response.shape
		mask = np.asarray(response >= THRESHOLD, dtype=np.uint8)
		mask_path = OUTPUT / f"{image.stem}.mask"
		native_path = OUTPUT / f"{image.stem}.f64"
		mask.tofile(mask_path)
		started = time.perf_counter()
		subprocess.run([str(probe), str(mask_path), str(native_path), str(width), str(height)], check=True)
		native_ms = (time.perf_counter() - started) * 1000.0
		expected = expected_features(response)
		actual = np.fromfile(native_path, dtype="<f8")
		compare(expected, actual, image.name)
		native_path.unlink()
		results[image.name] = {
			"width": width,
			"height": height,
			"mask": f"generated/blob_feature_parity/{image.stem}.mask",
			"features": json_features(expected),
			"native_blob_ms": native_ms,
		}
	(OUTPUT / "expected.json").write_text(json.dumps(results, indent=2) + "\n")
	print(f"Native Rust/Python parity passed for {len(results)} real images at threshold {THRESHOLD}.")


if __name__ == "__main__":
	main()

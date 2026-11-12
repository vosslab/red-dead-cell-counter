#!/usr/bin/env python3
"""Benchmark threshold rules on the native Rust DoG response."""

from __future__ import annotations

import argparse
import csv
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from skimage.filters import threshold_otsu, threshold_triangle


ROOT = Path(
	subprocess.run(
		["git", "rev-parse", "--show-toplevel"],
		cwd=Path(__file__).resolve().parent,
		check=True,
		capture_output=True,
		text=True,
	).stdout.strip()
)
RAW = (0.1, 0.01, 0.001, 0.0001, 0.00002, 0.00001)


def shifted(array: np.ndarray, dy: int, dx: int) -> np.ndarray:
	"""Return each pixel's neighbor at offset dy/dx, or negative infinity."""
	result = np.full_like(array, -np.inf)
	source_y = slice(max(0, dy), array.shape[0] + min(0, dy))
	source_x = slice(max(0, dx), array.shape[1] + min(0, dx))
	target_y = slice(max(0, -dy), array.shape[0] - max(0, dy))
	target_x = slice(max(0, -dx), array.shape[1] - max(0, dx))
	result[target_y, target_x] = array[source_y, source_x]
	return result


def local_maxima(response: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
	"""Match Rust's 3x3 strongest-neighbor and lexicographic plateau owner."""
	maximum = ndimage.maximum_filter(response, size=3, mode="constant", cval=-np.inf)
	keep = (response > 0) & (response == maximum)
	for dy, dx in ((-1, -1), (-1, 0), (-1, 1), (0, -1)):
		keep &= response != shifted(response, dy, dx)
	ys, xs = np.nonzero(keep)
	scores = response[ys, xs]
	order = np.lexsort((xs, ys, -scores))
	return scores[order], ys[order], xs[order]


def suppress(scores: np.ndarray, ys: np.ndarray, xs: np.ndarray, lowest: float) -> tuple[np.ndarray, np.ndarray]:
	"""Match the detector's strict 5-pixel-distance grid NMS at the lowest cutoff."""
	points: list[tuple[int, int]] = []
	kept_scores: list[float] = []
	grid: dict[tuple[int, int], list[int]] = {}
	for score, y, x in zip(scores, ys, xs, strict=True):
		if score < lowest:
			break
		bucket = int(x) // 10, int(y) // 10
		overlaps = False
		for grid_y in range(bucket[1] - 1, bucket[1] + 2):
			for grid_x in range(bucket[0] - 1, bucket[0] + 2):
				for index in grid.get((grid_x, grid_y), []):
					other_y, other_x = points[index]
					if (int(x) - other_x) ** 2 + (int(y) - other_y) ** 2 < 25:
						overlaps = True
						break
				if overlaps:
					break
			if overlaps:
				break
		if not overlaps:
			grid.setdefault(bucket, []).append(len(points))
			points.append((int(y), int(x)))
			kept_scores.append(float(score))
	return np.asarray(kept_scores), np.asarray(points, dtype=np.int32)


def cutoff_rules(response: np.ndarray, peak_scores: np.ndarray) -> dict[str, float | None]:
	"""Return raw DoG cutoffs, preserving undefined zero-MAD cases."""
	positive = response[response > 0]
	median = float(np.median(response))
	mad = float(np.median(np.abs(response - median)))
	result: dict[str, float | None] = {f"raw_{value:g}": value for value in RAW}
	result.update({f"mean_{multiple}sd": float(response.mean() + multiple * response.std()) for multiple in (2, 3, 4)})
	result.update({f"median_{multiple}mad": median + multiple * 1.4826 * mad if mad > 0 else None for multiple in (3, 5, 8)})
	if positive.size and np.ptp(positive) > 0:
		result["otsu_positive_pixels"] = round(float(threshold_otsu(positive)), 5)
		result["triangle_positive_pixels"] = round(float(threshold_triangle(positive)), 5)
	else:
		result["otsu_positive_pixels"] = None
		result["triangle_positive_pixels"] = None
	if peak_scores.size and np.ptp(peak_scores) > 0:
		result["otsu_peak_scores"] = round(float(threshold_otsu(peak_scores)), 5)
		result["triangle_peak_scores"] = round(float(threshold_triangle(peak_scores)), 5)
	else:
		result["otsu_peak_scores"] = None
		result["triangle_peak_scores"] = None
	return result


def run_probe(image: Path, output: Path) -> tuple[np.ndarray, np.ndarray]:
	"""Use a native imageproc probe for one response map and one detector baseline."""
	rgba = np.asarray(Image.open(image).convert("RGBA"), dtype=np.uint8)
	height, width = rgba.shape[:2]
	rgba_path = output / f"{image.stem}.rgba"
	response_path = output / f"{image.stem}.f32"
	centers_path = output / f"{image.stem}.centers"
	rgba.tofile(rgba_path)
	binary = ROOT / "rust/target/release/examples/threshold_probe"
	subprocess.run([str(binary), str(rgba_path), str(response_path), str(centers_path), str(width), str(height)], check=True)
	response = np.fromfile(response_path, dtype="<f4").reshape(height, width)
	centers = np.fromfile(centers_path, dtype="<f4").reshape(-1, 2).astype(np.int32)
	rgba_path.unlink()
	response_path.unlink()
	centers_path.unlink()
	return response, centers


def overlay(image: Path, candidates: dict[str, np.ndarray], output: Path) -> None:
	"""Write a center-crop overlay for fixed, adaptive, and tiny threshold picks."""
	source = Image.open(image).convert("RGB")
	width, height = source.size
	left, top = (width - 800) // 2, (height - 800) // 2
	crop = source.crop((left, top, left + 800, top + 800))
	panel = Image.new("RGB", (800 * len(candidates), 800))
	for index, (name, points) in enumerate(candidates.items()):
		marked = crop.copy()
		draw = ImageDraw.Draw(marked)
		for y, x in points:
			if left <= x < left + 800 and top <= y < top + 800:
				draw.ellipse((x - left - 5, y - top - 5, x - left + 5, y - top + 5), outline="lime", width=2)
		draw.rectangle((0, 0, 300, 30), fill="black")
		draw.text((6, 7), f"{name}: {len(points)}", fill="white")
		panel.paste(marked, (index * 800, 0))
	panel.save(output / f"{image.stem}_thresholds.jpg", quality=90)


def self_check() -> None:
	"""Check lexicographic plateau and strict-distance boundary semantics."""
	response = np.zeros((3, 3), dtype=np.float32)
	response[0, 0] = response[0, 1] = 1
	scores, ys, xs = local_maxima(response)
	if list(zip(ys, xs)) != [(0, 0)]:
		raise RuntimeError("lexicographic plateau check failed")
	kept_scores, kept = suppress(np.array([3.0, 2.0]), np.array([0, 0]), np.array([0, 5]), 0.1)
	if len(kept_scores) != 2 or list(map(tuple, kept)) != [(0, 0), (0, 5)]:
		raise RuntimeError("strict-distance check failed")


def main() -> None:
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("--images", type=Path, default=ROOT / "IMAGES")
	parser.add_argument("--output", type=Path, default=ROOT / "generated/threshold_experiment")
	args = parser.parse_args()
	output = args.output
	output.mkdir(parents=True, exist_ok=True)
	self_check()
	subprocess.run(["cargo", "build", "--quiet", "--release", "--manifest-path", "rust/Cargo.toml", "--example", "threshold_probe"], cwd=ROOT, check=True)
	references = {row["filename"]: int(row["reference_count"]) for row in csv.DictReader((ROOT / "docs/REFERENCE_COUNTS.csv").open())}
	rows: list[dict[str, object]] = []
	overlays: dict[str, dict[str, np.ndarray]] = {}
	for image in sorted(args.images.glob("*.jpg")):
		response, native = run_probe(image, output)
		scores, ys, xs = local_maxima(response)
		choices = cutoff_rules(response, scores)
		valid = [cutoff for cutoff in choices.values() if cutoff is not None and cutoff > 0]
		kept_scores, kept = suppress(scores, ys, xs, min(valid))
		baseline = kept[kept_scores >= 0.1][:, ::-1]
		if not np.array_equal(baseline, native):
			raise RuntimeError(f"{image.name}: Python/Rust baseline centers differ")
		response_median = float(np.median(response))
		row: dict[str, object] = {"image": image.name, "reference": references[image.name], "positive_maxima": len(scores), "response_mean": float(response.mean()), "response_std": float(response.std()), "response_median": response_median, "response_mad": float(np.median(np.abs(response - response_median)))}
		row.update({f"cutoff_{name}": cutoff for name, cutoff in choices.items()})
		for name, cutoff in choices.items():
			row[f"count_{name}"] = None if cutoff is None or cutoff <= 0 else int(np.count_nonzero(kept_scores >= cutoff))
		rows.append(row)
		if image.stem in {"A501", "B301"}:
			for name in ("raw_0.1", "otsu_positive_pixels", "raw_1e-05"):
				cutoff = choices[name]
				if cutoff is not None:
					overlays.setdefault(image.stem, {})[name] = kept[kept_scores >= cutoff]
	for stem, candidates in overlays.items():
		overlay(args.images / f"{stem}.jpg", candidates, output)
	(output / "results.json").write_text(json.dumps(rows, indent=2))
	fieldnames = list(rows[0])
	with (output / "results.csv").open("w", newline="") as handle:
		writer = csv.DictWriter(handle, fieldnames=fieldnames)
		writer.writeheader()
		writer.writerows(rows)
	summary: dict[str, float | None] = {}
	for name in fieldnames:
		if not name.startswith("count_"):
			continue
		usable = [row for row in rows if isinstance(row[name], int)]
		summary[name] = sum(abs(int(row[name]) - int(row["reference"])) / int(row["reference"]) for row in usable) / len(usable) if usable else None
	(output / "summary.json").write_text(json.dumps(summary, indent=2))
	print(json.dumps(summary, indent=2))


if __name__ == "__main__":
	main()

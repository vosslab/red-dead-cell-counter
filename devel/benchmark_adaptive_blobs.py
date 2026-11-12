#!/usr/bin/env python3
"""Run the frozen six-policy adaptive blob experiment on native DoG responses."""

# Standard Library
import csv
import sys
import gzip
import json
import time
import hashlib
import pathlib
import argparse
import datetime
import platform
import resource
import subprocess

# PIP3 modules
import numpy
import scipy
import PIL

# Local repo modules
import benchmark_thresholds
import measure_blob_areas
import adaptive_blob_analysis
import adaptive_blob_gallery
import adaptive_blob_scoring


ROOT = benchmark_thresholds.ROOT
POLICIES = ("P", "L", "LS", "LSC", "LSI", "LSCI")
THRESHOLDS = (0.08, 0.1, 0.12)
FEATURE_COUNTS = {"P": 0, "L": 1, "LS": 2, "LSC": 3, "LSI": 3, "LSCI": 4}


def file_hash(path: pathlib.Path) -> str:
	"""Hash source or input bytes without persisting another copy."""
	with path.open("rb") as handle:
		result = hashlib.file_digest(handle, "sha256").hexdigest()
	return result


def write_json(path: pathlib.Path, value: object) -> None:
	"""Write a readable complete JSON artifact."""
	path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n")


def write_csv(path: pathlib.Path, rows: list[dict]) -> None:
	"""Export spreadsheet-safe fields at the CSV output boundary."""
	with path.open("w", newline="") as handle:
		writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
		writer.writeheader()
		for row in rows:
			# ASVS 1.2.10: existing CSV encoding protects formula-leading filenames.
			writer.writerow({key: measure_blob_areas.safe_csv_cell(value)
				if isinstance(value, str) else value for key, value in row.items()})


def baseline_choices(response: numpy.ndarray) -> dict[float, numpy.ndarray]:
	"""Reuse strict Rust-compatible local maxima and NMS for all three thresholds."""
	scores, ys, xs = benchmark_thresholds.local_maxima(response)
	kept_scores, kept_yx = benchmark_thresholds.suppress(scores, ys, xs, min(THRESHOLDS))
	kept_yx = kept_yx.reshape(-1, 2)
	choices = {threshold: kept_yx[kept_scores >= numpy.float32(threshold), ::-1].copy()
		for threshold in THRESHOLDS}
	return choices


def verify_invariance(response: numpy.ndarray) -> dict:
	"""Check a real crop with copied pixels, reversed input centers and policy order."""
	height, width = response.shape
	left, top = max(0, width // 2 - 150), max(0, height // 2 - 150)
	crop = response[top:top + 300, left:left + 300].copy()
	centers = baseline_choices(crop)[0.1]
	first = adaptive_blob_analysis.prepare_response(crop, centers, 0.1, diameter=10)
	second = adaptive_blob_analysis.prepare_response(crop.copy(), centers[::-1].copy(), 0.1, diameter=10)
	original = {policy: first.analyze(policy) for policy in POLICIES}
	for policy in reversed(POLICIES):
		current = second.analyze(policy)
		# Inference accepts pixels and centers only; a file rename cannot enter this API.
		first_centers = original[policy]["centers"]
		second_centers = current["centers"]
		first_order = numpy.lexsort((first_centers[:, 0], first_centers[:, 1]))
		second_order = numpy.lexsort((second_centers[:, 0], second_centers[:, 1]))
		if not numpy.array_equal(first_centers[first_order], second_centers[second_order]):
			raise RuntimeError(f"real-crop center/order invariance failed for {policy}")
		if original[policy]["decisions"] != current["decisions"]:
			raise RuntimeError(f"real-crop decision/order invariance failed for {policy}")
		if not numpy.array_equal(original[policy]["mask"], current["mask"]):
			raise RuntimeError(f"real-crop mask/order invariance failed for {policy}")
	result = {"bounds": [left, top, left + crop.shape[1], top + crop.shape[0]],
		"input_centers": len(centers), "policies": list(POLICIES), "passed": True,
		"check": "copied real crop; reversed baseline centers and policy order; inference API has no filename"}
	return result


def score_results(rows: list[dict], references_path: pathlib.Path) -> dict:
	"""Join human evidence only after every detection output has been written."""
	with references_path.open(newline="") as handle:
		references = {row["filename"]: int(row["reference_count"]) for row in csv.DictReader(handle)}
	scored = [{**row, **adaptive_blob_scoring.score_count(row["count"], references[row["image"]])}
		for row in rows]
	by_policy = {}
	grouped = {}
	for policy in POLICIES:
		by_policy[policy] = {}
		for threshold in THRESHOLDS:
			current = [row for row in scored if row["policy"] == policy and row["threshold"] == threshold]
			grouped[policy, threshold] = current
			by_policy[policy][f"{threshold:.2f}"] = adaptive_blob_scoring.summarize(current)
	# Exact summary ties prefer fewer features, then measured analysis runtime.
	individual = min(("LSC", "LSI"), key=lambda policy: (
		by_policy[policy]["0.10"]["mean_loss"],
		FEATURE_COUNTS[policy], sum(row["analysis_seconds"] for row in grouped[policy, 0.1]), policy))
	pairs = [("L", "P"), ("LS", "L"), ("LSC", "LS"), ("LSI", "LS"), ("LSCI", individual)]
	comparisons = {}
	for candidate, baseline in pairs:
		sensitivity = [(grouped[candidate, threshold], grouped[baseline, threshold])
			for threshold in (0.08, 0.12)]
		comparison = adaptive_blob_scoring.assess_candidate(
			grouped[candidate, 0.1], grouped[baseline, 0.1], sensitivity)
		comparison.update({"candidate": candidate, "baseline": baseline})
		key = "LSCI_vs_best_individual" if candidate == "LSCI" else f"{candidate}_vs_{baseline}"
		comparisons[key] = comparison
	result = {"rows": scored, "by_policy": by_policy, "comparisons": comparisons,
		"best_individual": individual, "selection": "provisional evidence; no production policy adopted",
		"reference_provenance": "Human ImageJ totals, stated +/-10% uncertainty; band [H/1.10,H/0.90]. Count agreement does not establish object-level biological accuracy."}
	return result


def parse_args() -> argparse.Namespace:
	"""Accept only the real input and generated output locations."""
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("-i", "--images", dest="images", type=pathlib.Path, default=ROOT / "IMAGES")
	parser.add_argument("-o", "--output", dest="output", type=pathlib.Path,
		default=ROOT / "generated/adaptive_blob_experiment")
	args = parser.parse_args()
	return args


def main() -> None:
	"""Save all 144 inference cases, then score and emit a reviewable gallery."""
	args = parse_args()
	started = time.perf_counter()
	images = sorted(args.images.glob("*.jpg"))
	if len(images) != 8:
		raise ValueError(f"frozen experiment requires 8 real JPEGs; found {len(images)}")
	output = args.output
	output.mkdir(parents=True, exist_ok=True)
	(output / "cases").mkdir(exist_ok=True)
	source_paths = [pathlib.Path(__file__), ROOT / "devel/adaptive_blob_gallery.py",
		ROOT / "devel/adaptive_blob_analysis.py", ROOT / "devel/adaptive_blob_scoring.py",
		ROOT / "devel/benchmark_thresholds.py", ROOT / "devel/measure_blob_areas.py",
		ROOT / "rust/examples/threshold_probe.rs", ROOT / "rust/src/lib.rs", ROOT / "rust/Cargo.lock"]
	manifest = {"created_utc": datetime.datetime.now(datetime.UTC).isoformat(),
		"command": [sys.executable, *sys.argv], "python": sys.version,
		"runtime": {"platform": platform.platform(), "numpy": numpy.__version__,
			"scipy": scipy.__version__, "pillow": PIL.__version__},
		"policies": list(POLICIES), "thresholds": list(THRESHOLDS), "diameter": 10, "k": 4,
		"expected_cases": 144, "reference_join": "after every detection case has been saved",
		"input_sha256": {image.name: file_hash(image) for image in images},
		"source_sha256": {str(path.relative_to(ROOT)): file_hash(path) for path in source_paths},
		"rules": "Frozen analysis/scoring source hashes above define policy decisions and retention. Native Rust DoG; strict 5-pixel NMS; row-major plateau ownership; no filename or reference data passed to analysis.",
		"reference_provenance": "docs/REFERENCE_COUNTS.csv; human ImageJ totals with +/-10% stated uncertainty"}
	write_json(output / "manifest.json", manifest)
	build_started = time.perf_counter()
	subprocess.run(["cargo", "build", "--quiet", "--release", "--manifest-path",
		"rust/Cargo.toml", "--example", "threshold_probe"], cwd=ROOT, check=True)
	timings = {"native_build_seconds": time.perf_counter() - build_started, "images": []}
	rows = []
	gallery_entries = []
	decision_path = output / "parent_decisions.csv"
	with decision_path.open("w", newline="") as decision_handle:
		writer = csv.DictWriter(decision_handle, fieldnames=["image", "policy", "case_id",
			"base_threshold", "parent_id",
			"bounds", "area_px", "compactness", "inertia_ratio", "inertia_eligible",
			"before_count", "after_count", "action", "threshold", "reason",
			"thresholds_examined", "trigger"])
		writer.writeheader()
		for image_index, image in enumerate(images):
			image_started = time.perf_counter()
			probe_started = time.perf_counter()
			response, native = benchmark_thresholds.run_probe(image, output)
			probe_seconds = time.perf_counter() - probe_started
			baselines = baseline_choices(response)
			if not numpy.array_equal(baselines[0.1], native):
				raise RuntimeError(f"{image.name}: Python/native 0.1 centers differ")
			image_timing = {"image": image.name, "native_probe_seconds": probe_seconds,
				"native_baseline_agreement": True, "thresholds": {}}
			if image_index == 0:
				manifest["invariance_check"] = verify_invariance(response)
			for threshold in THRESHOLDS:
				prepare_started = time.perf_counter()
				prepared = adaptive_blob_analysis.prepare_response(response, baselines[threshold], threshold, diameter=10)
				prepare_seconds = time.perf_counter() - prepare_started
				image_timing["thresholds"][f"{threshold:.2f}"] = {"prepare_seconds": prepare_seconds}
				gallery_results = {}
				for policy in POLICIES:
					analysis_started = time.perf_counter()
					result = prepared.analyze(policy)
					analysis_seconds = time.perf_counter() - analysis_started
					case_id = f"image_{image_index:02d}_t{int(threshold * 100):02d}_{policy.lower()}"
					if len(result["decisions"]) != len(prepared.parents):
						raise RuntimeError(f"{case_id}: missing parent decisions")
					if sum(row["after_count"] for row in result["decisions"]) != len(result["centers"]):
						raise RuntimeError(f"{case_id}: parent decisions do not account for every center")
					if policy == "P" and not numpy.array_equal(result["centers"], baselines[threshold]):
						raise RuntimeError(f"{case_id}: P policy changed baseline centers")
					numpy.savez_compressed(output / "cases" / f"{case_id}.npz", centers=result["centers"])
					with gzip.open(output / "cases" / f"{case_id}.json.gz", "wt") as handle:
						json.dump({"image": image.name, "policy": policy, "threshold": threshold,
							"decisions": result["decisions"], "reference_area": result["reference_area"],
							"area_min": result["area_min"], "area_max": result["area_max"]}, handle, allow_nan=False)
					for decision in result["decisions"]:
						csv_row = {"image": measure_blob_areas.safe_csv_cell(image.name), "policy": policy,
							"case_id": case_id, "base_threshold": threshold,
							**decision, "bounds": json.dumps(decision["bounds"])}
						writer.writerow(csv_row)
					row = {"image": image.name, "policy": policy, "threshold": threshold,
						"count": len(result["centers"]), "parents": len(result["decisions"]),
						"analysis_seconds": analysis_seconds, "prepare_seconds_shared": prepare_seconds,
						"case_id": case_id, "reference_area": result["reference_area"],
						"area_min": result["area_min"], "area_max": result["area_max"]}
					rows.append(row)
					if threshold == 0.1:
						gallery_results[policy] = result
				if threshold == 0.1:
					gallery_entries.extend(adaptive_blob_gallery.save_image_crops(
						image, response, gallery_results, output / "gallery", f"image_{image_index:02d}"))
				del prepared, gallery_results, result
			image_timing["total_seconds"] = time.perf_counter() - image_started
			timings["images"].append(image_timing)
			print(f"{image.name}: native agreement; 18 cases saved ({image_timing['total_seconds']:.1f}s)", flush=True)
			del response, native, baselines
	if len(rows) != 144:
		raise RuntimeError(f"incomplete experiment: {len(rows)} cases")
	# This unscored index is written before reference totals are opened.
	write_json(output / "detections.json", rows)
	for path in source_paths:
		if file_hash(path) != manifest["source_sha256"][str(path.relative_to(ROOT))]:
			raise RuntimeError(f"source changed during frozen experiment: {path}")
	manifest["completed_detection_cases"] = len(rows)
	write_json(output / "manifest.json", manifest)
	summary = score_results(rows, ROOT / "docs/REFERENCE_COUNTS.csv")
	write_json(output / "summary.json", summary)
	write_csv(output / "results.csv", summary["rows"])
	adaptive_blob_gallery.write_gallery(gallery_entries, output)
	timings["total_seconds"] = time.perf_counter() - started
	rss_scale = 1 if sys.platform == "darwin" else 1024
	timings["max_python_rss_bytes"] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * rss_scale
	timings["max_child_rss_bytes"] = resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss * rss_scale
	write_json(output / "timings.json", timings)
	report = f"# Adaptive blob experiment\n\nCompleted {len(rows)} cases on 8 real JPEGs. Native/Python 0.1 baseline centers agree exactly for every image.\n\n"
	report += "Human ImageJ totals were joined after all detection outputs were saved. Their stated +/-10% uncertainty defines [H/1.10,H/0.90]. This evaluates count agreement, not cell identity or detection accuracy.\n\n"
	report += f"Command: `{ ' '.join(manifest['command']) }`\n\nElapsed: {timings['total_seconds']:.2f} seconds. See timings.json for preparation, policy and native timing.\n\n"
	report += "| Policy | Mean outside loss | Worst loss | In band / 8 |\n| --- | ---: | ---: | ---: |\n"
	for policy in POLICIES:
		stats = summary["by_policy"][policy]["0.10"]
		report += f"| {policy} | {stats['mean_loss']:.6f} | {stats['worst_loss']:.6f} | {stats['in_band_count']} |\n"
	report += "\nComparisons and sensitivity gates are in summary.json. All parent decisions are in parent_decisions.csv; exact centers and decisions are in cases/. Crop evidence is in gallery.html. No production policy was adopted by this harness.\n"
	(output / "report.md").write_text(report)
	print(json.dumps({"by_policy": summary["by_policy"], "comparisons": summary["comparisons"]}, indent=2))


if __name__ == "__main__":
	main()

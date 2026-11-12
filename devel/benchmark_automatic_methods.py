#!/usr/bin/env python3
"""Run the frozen three-selector experiment, saving predictions before reading totals."""

# Standard library
import csv
import json
import time
import pathlib
import hashlib
import argparse
import tempfile
import subprocess

# PIP modules
import PIL.Image
import PIL.ImageDraw


#============================================
def interval_loss(count: int, reference: int) -> float:
	"""Measure distance outside the reference uncertainty interval, divided by H."""
	lower, upper = reference / 1.1, reference / 0.9
	loss = max(lower - count, count - upper, 0.0) / reference
	return loss


#============================================
def summarize(rows: list[dict], references: dict[str, int], selector: str) -> dict:
	"""Evaluate one globally fixed rule after prediction files have been written."""
	losses = []
	center_errors = []
	for row in rows:
		result = next(result for result in row["results"] if result["selector"] == selector)
		reference = references[row["image"]]
		losses.append(interval_loss(result["count"], reference))
		center_errors.append(abs(result["count"] - reference) / reference)
	summary = {
		"selector": selector,
		"outside_images": sum(loss > 0 for loss in losses),
		"worst_outside_loss": max(losses),
		"mean_outside_loss": sum(losses) / len(losses),
		"center_mape": sum(center_errors) / len(center_errors),
		"worst_center_error": max(center_errors),
	}
	return summary


#============================================
def save_overlay(image: pathlib.Path, result: dict, output: pathlib.Path) -> None:
	"""Record the chosen native center locations on a reviewable original-image crop."""
	with PIL.Image.open(image) as source:
		marked = source.convert("RGB")
	width, height = marked.size
	left, top = max(0, (width - 800) // 2), max(0, (height - 800) // 2)
	marked = marked.crop((left, top, min(width, left + 800), min(height, top + 800)))
	draw = PIL.ImageDraw.Draw(marked)
	centers = result["centers"]
	for x, y in zip(centers[::2], centers[1::2], strict=True):
		if left <= x < left + marked.width and top <= y < top + marked.height:
			draw.ellipse((x-left-5, y-top-5, x-left+5, y-top+5), outline="lime", width=2)
	draw.rectangle((0, 0, marked.width, 28), fill="black")
	label = f'{image.name}: {result["selector"]} t={result["threshold"]:.5f}'
	draw.text((6, 7), label, fill="white")
	marked.save(output / f"{image.stem}_chosen.webp", quality=90)


#============================================
def source_hashes(root: pathlib.Path) -> dict[str, str]:
	"""Freeze the numeric implementation, executable boundary, and experiment harness."""
	paths = ["rust/Cargo.toml", "rust/Cargo.lock", "rust/src/lib.rs",
		"rust/src/prepared_image.rs", "rust/src/automatic_threshold.rs",
		"rust/examples/automatic_probe.rs", "rust/examples/threshold_probe.rs",
		"devel/benchmark_automatic_methods.py"]
	hashes = {path: hashlib.sha256((root / path).read_bytes()).hexdigest() for path in paths}
	return hashes


#============================================
def stable_predictions(results: list[dict]) -> list[dict]:
	"""Exclude elapsed times when checking exact repeatability of numerical outputs."""
	stable = [{key: value for key, value in result.items() if key != "analysis_ms"}
		for result in results]
	return stable


#============================================
def main() -> None:
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("-o", "--output", dest="output", type=pathlib.Path,
		default=pathlib.Path("generated/automatic_threshold_experiment"))
	args = parser.parse_args()
	root = pathlib.Path(subprocess.run(
		["git", "rev-parse", "--show-toplevel"], check=True, capture_output=True, text=True,
	).stdout.strip())
	output = args.output.resolve()
	output.mkdir(parents=True, exist_ok=True)
	frozen_sources = source_hashes(root)
	subprocess.run(["cargo", "build", "--quiet", "--release", "--manifest-path",
		"rust/Cargo.toml", "--example", "automatic_probe"], cwd=root, check=True)
	binary = root / "rust/target/release/examples/automatic_probe"
	images = sorted((root / "IMAGES").glob("*.jpg"))
	if len(images) != 8:
		raise ValueError("The frozen experiment requires all eight original JPEG images")
	rows = []
	rename_receipt = {}
	for image in images:
		with PIL.Image.open(image) as source:
			rgba = source.convert("RGBA")
		with tempfile.TemporaryDirectory(dir=output) as temporary:
			# The native runtime receives identical temporary names, never calibration IDs.
			input_path = pathlib.Path(temporary) / "input.rgba"
			input_path.write_bytes(rgba.tobytes())
			start = time.perf_counter()
			process = subprocess.run([str(binary), str(input_path), str(rgba.width),
				str(rgba.height)], check=True, capture_output=True, text=True)
			elapsed = time.perf_counter() - start
			if not rows:
				renamed_path = pathlib.Path(temporary) / "different_identity.rgba"
				renamed_path.write_bytes(input_path.read_bytes())
				repeated = subprocess.run([str(binary), str(renamed_path), str(rgba.width),
					str(rgba.height)], check=True, capture_output=True, text=True)
				rename_equal = stable_predictions(json.loads(process.stdout)["results"]) == (
					stable_predictions(json.loads(repeated.stdout)["results"]))
				if not rename_equal:
					raise RuntimeError("Renamed identical RGBA input changed native predictions")
				rename_receipt = {"image": image.name, "original_name": input_path.name,
					"renamed_name": renamed_path.name, "predictions_identical": rename_equal}
		row = json.loads(process.stdout)
		row.update({"image": image.name, "width": rgba.width, "height": rgba.height,
			"image_sha256": hashlib.sha256(image.read_bytes()).hexdigest(),
			"process_seconds": elapsed})
		rows.append(row)
		(output / f"{image.stem}_predictions.json").write_text(json.dumps(row, indent=2) + "\n")
		print(f'{image.name}: response {row["response_ms"]:.1f} ms', flush=True)
	# Persist the complete oracle-free experiment before opening the reference-count file.
	raw_path = output / "predictions.json"
	raw_path.write_text(json.dumps(rows, indent=2) + "\n")
	prediction_hash = hashlib.sha256(raw_path.read_bytes()).hexdigest()
	if source_hashes(root) != frozen_sources:
		raise RuntimeError("Experiment source changed during the frozen run")
	manifest = {"source_sha256": frozen_sources,
		"binary_sha256": hashlib.sha256(binary.read_bytes()).hexdigest(),
		"inputs": [{"image": row["image"], "sha256": row["image_sha256"],
			"width": row["width"], "height": row["height"]} for row in rows],
		"sources_unchanged_after_run": True, "rename_receipt": rename_receipt,
		"predictions_sha256": prediction_hash,
		"rustc": subprocess.run(["rustc", "--version"], check=True,
			capture_output=True, text=True).stdout.strip()}
	with (root / "docs/REFERENCE_COUNTS.csv").open() as handle:
		references = {row["filename"]: int(row["reference_count"]) for row in csv.DictReader(handle)}
	if set(references) != {row["image"] for row in rows}:
		raise ValueError("Image predictions and calibration references differ")
	selectors = ["binary_otsu", "li", "multi_otsu", "fixed_0.10000", "fixed_0.12000"]
	summaries = [summarize(rows, references, selector) for selector in selectors]
	# Changing the evaluation oracle cannot alter already-persisted native predictions.
	changed_references = {image: count * 2 for image, count in references.items()}
	changed_evaluation = [summarize(rows, changed_references, selector) for selector in selectors]
	if summaries == changed_evaluation:
		raise RuntimeError("Changed reference counts did not change evaluation")
	if hashlib.sha256(raw_path.read_bytes()).hexdigest() != prediction_hash:
		raise RuntimeError("Evaluation changed saved image-only predictions")
	manifest["reference_injection_receipt"] = {"injected_totals": "all H multiplied by 2",
		"evaluation_changed": True, "saved_prediction_hash_unchanged": True,
		"native_runtime_reexecuted_for_reference_change": False}
	(output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
	order = {selector: index for index, selector in enumerate(selectors)}
	ranked = sorted(summaries[:3], key=lambda summary: (
		summary["outside_images"], summary["worst_outside_loss"],
		summary["mean_outside_loss"], order[summary["selector"]],
	))
	chosen = ranked[0]["selector"]
	summary = {"chosen": chosen, "predictions_sha256": prediction_hash,
		"ranking": ranked, "fixed_baselines": summaries[3:]}
	leave_one_out = []
	for omitted in rows:
		remaining = [row for row in rows if row["image"] != omitted["image"]]
		stress = [summarize(remaining, references, selector) for selector in selectors[:3]]
		stress.sort(key=lambda result: (result["outside_images"], result["worst_outside_loss"],
			result["mean_outside_loss"], order[result["selector"]]))
		leave_one_out.append({"omitted_image": omitted["image"], "chosen": stress[0]["selector"]})
	summary["leave_one_out_stress"] = leave_one_out
	(output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
	with (output / "evaluation.csv").open("w", newline="") as handle:
		fields = ["image", "reference", "interval_lower", "interval_upper", "selector",
			"threshold", "count", "outside_loss", "center_error", "response_ms", "analysis_ms"]
		writer = csv.DictWriter(handle, fieldnames=fields)
		writer.writeheader()
		for row in rows:
			reference = references[row["image"]]
			for result in row["results"]:
				writer.writerow({"image": row["image"], "reference": reference,
					"interval_lower": reference / 1.1, "interval_upper": reference / 0.9,
					"selector": result["selector"], "threshold": result["threshold"],
					"count": result["count"], "outside_loss": interval_loss(result["count"], reference),
					"center_error": abs(result["count"] - reference) / reference,
					"response_ms": row["response_ms"], "analysis_ms": result["analysis_ms"]})
			result = next(result for result in row["results"] if result["selector"] == chosen)
			save_overlay(root / "IMAGES" / row["image"], result, output)
	print(json.dumps(summary, indent=2))


if __name__ == "__main__":
	main()

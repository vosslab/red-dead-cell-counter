#!/usr/bin/env python3
"""Render native saved automatic/fixed center comparisons without rerunning inference."""

# Standard library
import json
import pathlib
import hashlib
import subprocess

# PIP modules
import PIL.Image
import PIL.ImageDraw


#============================================
def points(result: dict) -> set[tuple[int, int]]:
	centers = result["centers"]
	locations = {(int(x), int(y)) for x, y in zip(centers[::2], centers[1::2], strict=True)}
	return locations


#============================================
def render(source: PIL.Image.Image, row: dict, bounds: tuple[int, int, int, int],
	output: pathlib.Path) -> dict:
	"""Draw aligned original pixels, fixed picks, and selected automatic picks."""
	left, top, right, bottom = bounds
	crop = source.crop(bounds).convert("RGB")
	scale = max(1, min(6, 384 // max(crop.size)))
	width, height = crop.width * scale, crop.height * scale
	canvas = PIL.Image.new("RGB", (width * 3, height + 38), "black")
	selections = [None, "fixed_0.10000", "binary_otsu"]
	counts = {}
	for index, selector in enumerate(selections):
		panel = crop.resize((width, height), PIL.Image.Resampling.NEAREST)
		label = "Original pixels"
		if selector is not None:
			result = next(result for result in row["results"] if result["selector"] == selector)
			draw = PIL.ImageDraw.Draw(panel)
			kept = [(x, y) for x, y in points(result) if left <= x < right and top <= y < bottom]
			for x, y in kept:
				cx, cy = (x-left) * scale, (y-top) * scale
				radius = max(3, 4 * scale)
				draw.ellipse((cx-radius, cy-radius, cx+radius, cy+radius), outline="lime", width=2)
			counts[selector] = len(kept)
			label = f'{selector}: {len(kept)} picks, t={result["threshold"]:.5f}'
		canvas.paste(panel, (index * width, 38))
		PIL.ImageDraw.Draw(canvas).text((index * width + 4, 6), label, fill="white")
	canvas.save(output, quality=90)
	record = {"image": row["image"], "bounds": bounds, "counts": counts, "file": output.name}
	return record


#============================================
def main() -> None:
	root = pathlib.Path(subprocess.run(["git", "rev-parse", "--show-toplevel"],
		check=True, capture_output=True, text=True).stdout.strip())
	output = root / "generated/automatic_threshold_experiment"
	predictions = output / "predictions.json"
	rows = json.loads(predictions.read_text())
	gallery = output / "gallery"
	gallery.mkdir(exist_ok=True)
	hard = {"A501.jpg": [(3658, 3302, 3718, 3350)],
		"F201.jpg": [(2289, 3892, 2350, 3943)],
		"H501.jpg": [(501, 2287, 567, 2335), (1888, 1888, 2212, 2212),
			(3567, 1072, 3619, 1128)]}
	receipts = []
	for row in rows:
		image = root / "IMAGES" / row["image"]
		if hashlib.sha256(image.read_bytes()).hexdigest() != row["image_sha256"]:
			raise ValueError(f"Original image changed since inference: {image.name}")
		with PIL.Image.open(image) as source:
			for index, bounds in enumerate(hard.get(image.name, [])):
				receipts.append(render(source, row, bounds, gallery / f"{image.stem}_hard_{index}.webp"))
			fixed = next(result for result in row["results"] if result["selector"] == "fixed_0.10000")
			chosen = next(result for result in row["results"] if result["selector"] == "binary_otsu")
			changed = points(fixed) ^ points(chosen)
			tiles = [(x, y, min(x+512, source.width), min(y+512, source.height))
				for y in range(0, source.height, 512) for x in range(0, source.width, 512)]
			# max retains the first row-major tile on equal change counts.
			bounds = max(tiles, key=lambda tile: sum(tile[0] <= x < tile[2] and
				tile[1] <= y < tile[3] for x, y in changed))
			receipts.append(render(source, row, bounds, gallery / f"{image.stem}_most_changed.webp"))
	manifest = {"predictions_sha256": hashlib.sha256(predictions.read_bytes()).hexdigest(),
		"renderer_sha256": hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
		"crops": receipts}
	(gallery / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
	print(f"Saved {len(receipts)} aligned native center-comparison crops to {gallery}")


if __name__ == "__main__":
	main()

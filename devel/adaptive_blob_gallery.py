"""Write real-image crop evidence for the adaptive blob experiment."""

# Standard Library
import html
import json
import pathlib

# PIP3 modules
import numpy
import PIL.Image
import PIL.ImageDraw

# Local repo modules
import measure_blob_areas


def selected_crops(image: str, results: dict) -> list[dict]:
	"""Select documented crops and each policy's largest signed parent changes."""
	crops = {}
	for bounds in measure_blob_areas.CROPS.get(image, ()):
		crops[tuple(bounds)] = {"bounds": list(bounds), "selected_by": ["documented hard crop"]}
	for policy, result in results.items():
		decisions = result["decisions"]
		for sign, label in ((1, "positive"), (-1, "negative")):
			changed = [row for row in decisions if sign * (row["after_count"] - row["before_count"]) > 0]
			changed.sort(key=lambda row: (-sign * (row["after_count"] - row["before_count"]), row["parent_id"]))
			for row in changed[:3]:
				bounds = tuple(row["bounds"])
				if bounds not in crops:
					crops[bounds] = {"bounds": list(bounds), "selected_by": []}
				crops[bounds]["selected_by"].append(f"{policy} top {label} parent {row['parent_id']}")
	return list(crops.values())


def draw_centers(image: PIL.Image.Image, centers: numpy.ndarray, bounds: tuple) -> int:
	"""Draw actual xy centers within the crop and return their count."""
	left, top, right, bottom = bounds
	inside = centers[(centers[:, 0] >= left) & (centers[:, 0] < right)
		& (centers[:, 1] >= top) & (centers[:, 1] < bottom)]
	draw = PIL.ImageDraw.Draw(image)
	for x, y in inside:
		x, y = int(x) - left, int(y) - top
		draw.ellipse((x - 3, y - 3, x + 3, y + 3), outline="lime", width=1)
	return len(inside)


def save_image_crops(
	image_path: pathlib.Path, response: numpy.ndarray, results: dict,
	output: pathlib.Path, image_id: str,
) -> list[dict]:
	"""Save raw/DoG and each policy's mask/centers while the image is in memory."""
	output.mkdir(parents=True, exist_ok=True)
	with PIL.Image.open(image_path) as source:
		raw = source.convert("RGB")
	width, height = raw.size
	entries = []
	for index, selection in enumerate(selected_crops(image_path.name, results)):
		left, top, right, bottom = selection["bounds"]
		# A fixed context margin keeps tiny changed parents visible in real tissue.
		bounds = (max(0, left - 12), max(0, top - 12), min(width, right + 12), min(height, bottom + 12))
		left, top, right, bottom = bounds
		crop = raw.crop(bounds)
		local_response = response[top:bottom, left:right]
		low, high = float(local_response.min()), float(local_response.max())
		if high > low:
			dog = numpy.rint((local_response - low) / (high - low) * 255).astype(numpy.uint8)
		else:
			dog = numpy.zeros(local_response.shape, dtype=numpy.uint8)
		panels = [("Raw JPEG", crop), (f"DoG {low:.4g}..{high:.4g}", PIL.Image.fromarray(dog).convert("RGB"))]
		counts = {}
		decisions = {}
		for policy, result in results.items():
			mask = PIL.Image.fromarray(result["mask"][top:bottom, left:right]).convert("RGB")
			marked = crop.copy()
			counts[policy] = draw_centers(marked, result["centers"], bounds)
			panels.extend(((f"{policy} mask", mask), (f"{policy}: {counts[policy]} centers", marked)))
			decisions[policy] = [row for row in result["decisions"] if row["bounds"][0] < right
				and row["bounds"][2] > left and row["bounds"][1] < bottom and row["bounds"][3] > top]
		# Nearest-neighbor enlargement preserves the actual pixels in small evidence crops.
		scale = max(1, min(6, 280 // max(crop.size)))
		panel_width = max(200, crop.width * scale)
		panel_height = crop.height * scale + 28
		columns = 4
		canvas = PIL.Image.new("RGB", (panel_width * columns, panel_height * ((len(panels) + columns - 1) // columns)), "#202020")
		draw = PIL.ImageDraw.Draw(canvas)
		for panel_index, (label, panel) in enumerate(panels):
			x = panel_index % columns * panel_width
			y = panel_index // columns * panel_height
			draw.text((x + 5, y + 7), label, fill="white")
			canvas.paste(panel.resize((crop.width * scale, crop.height * scale), PIL.Image.Resampling.NEAREST), (x, y + 28))
		name = f"{image_id}_crop_{index:02d}.webp"
		canvas.save(output / name, quality=90)
		entry = {"image": image_path.name, "asset": f"gallery/{name}", "bounds": list(bounds),
			"selected_by": selection["selected_by"], "counts": counts, "decisions": decisions,
			"dog_display_min": low, "dog_display_max": high}
		entries.append(entry)
	return entries


def write_gallery(entries: list[dict], output: pathlib.Path) -> None:
	"""Write an escaped static gallery with machine-readable crop decisions."""
	(output / "gallery.json").write_text(json.dumps(entries, indent=2) + "\n")
	page = "<!doctype html><html lang='en'><meta charset='utf-8'><title>Adaptive blob evidence</title>"
	page += "<style>body{font:16px sans-serif;background:#202020;color:#eee;margin:24px}img{max-width:100%;height:auto}section{border-top:1px solid #888;padding:20px 0}pre{white-space:pre-wrap}a{color:#aef}</style>"
	page += "<h1>Adaptive blob experiment: real-image evidence</h1>"
	page += "<p>Threshold 0.1; diameter 10 px; k=4. Counts are provisional algorithm outputs. Human reference totals do not establish which visible objects are cells. Green rings mark actual emitted centers. Masks show actual threshold pixels; DoG panels use the stated per-crop display range. Panels use nearest-neighbor enlargement and WebP quality 90.</p>"
	for entry in entries:
		# ASVS 1.2.1: escape filenames and decision text at the HTML boundary.
		title = html.escape(f"{entry['image']} {entry['bounds']}")
		page += f"<section><h2>{title}</h2><p>{html.escape('; '.join(entry['selected_by']))}</p>"
		page += f"<img src='{entry['asset']}' alt='{title}: raw JPEG, DoG, masks and centers'>"
		page += "<details><summary>Parent decisions and counts</summary><pre>"
		page += html.escape(json.dumps({"counts": entry["counts"], "decisions": entry["decisions"]}, indent=2))
		page += "</pre></details></section>"
	page += "</html>\n"
	(output / "gallery.html").write_text(page)

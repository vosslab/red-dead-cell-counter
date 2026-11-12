#!/usr/bin/env python3
"""Measure red fluorescent objects and compare paper-derived DoG filters."""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage


def red_signal(pixels: np.ndarray) -> np.ndarray:
    """Return red fluorescence while suppressing yellow annotation pixels."""
    red = pixels[:, :, 0].astype(np.float32)
    other = np.maximum(pixels[:, :, 1], pixels[:, :, 2]).astype(np.float32)
    return np.maximum(red - other, 0.0) / 255.0


def sigma_for_radius(radius: float, k_factor: float) -> float:
    """Equation 4 from Voss et al. for a DoG matched to `radius` pixels."""
    return radius * math.sqrt((k_factor**2 - 1.0) / (2.0 * k_factor**2 * math.log(k_factor)))


def dog_peaks(signal: np.ndarray, radius: float, k_factor: float) -> np.ndarray:
    sigma_one = sigma_for_radius(radius, k_factor)
    dog = ndimage.gaussian_filter(signal, sigma_one) - ndimage.gaussian_filter(
        signal, sigma_one * k_factor
    )
    # Keep the raw DoG response: 0.04 is the application threshold, not a
    # per-image normalization that would change sensitivity between wells.
    peak_mask = (dog >= 0.04) & (dog == ndimage.maximum_filter(dog, 3))
    labels, count = ndimage.label(peak_mask)
    if count == 0:
        return np.empty((0, 2), dtype=np.float32)
    candidates: list[tuple[float, int, int]] = []
    for label, bounds in enumerate(ndimage.find_objects(labels), start=1):
        if bounds is None:
            continue
        y, x = np.argwhere(labels[bounds] == label)[0]
        y += bounds[0].start
        x += bounds[1].start
        candidates.append((float(dog[y, x]), int(y), int(x)))

    accepted: list[tuple[int, int]] = []
    for _, y, x in sorted(candidates, key=lambda peak: (-peak[0], peak[1], peak[2])):
        if all(math.hypot(y - other_y, x - other_x) >= radius for other_y, other_x in accepted):
            accepted.append((y, x))
    return np.asarray(accepted, dtype=np.float32)


def bright_component_diameters(signal: np.ndarray) -> np.ndarray:
    labels, count = ndimage.label(signal >= 0.25)
    if count == 0:
        return np.array([], dtype=np.float32)
    areas = np.bincount(labels.ravel())[1:]
    diameters = 2.0 * np.sqrt(areas / math.pi)
    return diameters[(diameters >= 6.0) & (diameters <= 40.0)]


def write_gallery(image_paths: list[Path]) -> None:
    """Write central real-image crops with the candidate peaks used in the table."""
    panels: list[Image.Image] = []
    for path in image_paths:
        source = Image.open(path).convert("RGB")
        width, height = source.size
        left, top = (width - 800) // 2, (height - 800) // 2
        crop = source.crop((left, top, left + 800, top + 800))
        signal = red_signal(np.asarray(crop))
        panel = Image.new("RGB", (2400, 800))
        for index, k_factor in enumerate((3.0, 4.0, 6.0)):
            marked = crop.copy()
            draw = ImageDraw.Draw(marked)
            for y, x in dog_peaks(signal, 7.0, k_factor):
                draw.ellipse((x - 8, y - 8, x + 8, y + 8), outline="lime", width=2)
            draw.rectangle((0, 0, 190, 28), fill="black")
            draw.text((6, 6), f"{path.stem} k={k_factor:g}", fill="white")
            panel.paste(marked, (index * 800, 0))
        panels.append(panel)

    gallery = Image.new("RGB", (2400, 800 * len(panels)))
    for index, panel in enumerate(panels):
        gallery.paste(panel, (0, index * 800))
    output = Path("generated/detector_comparison.jpg")
    output.parent.mkdir(exist_ok=True)
    gallery.save(output, quality=90)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("images", type=Path, nargs="?", default=Path("IMAGES"))
    args = parser.parse_args()

    image_paths = sorted(args.images.glob("*.jpg"))
    print("file,median_diameter_px,objects,k1.6,k3,k4,k6")
    for path in image_paths:
        signal = red_signal(np.asarray(Image.open(path).convert("RGB")))
        diameters = bright_component_diameters(signal)
        radius = float(np.median(diameters) / 2.0)
        counts = [len(dog_peaks(signal, 7.0, k)) for k in (1.6, 3.0, 4.0, 6.0)]
        print(
            f"{path.name},{radius * 2:.1f},{len(diameters)},"
            f"{counts[0]},{counts[1]},{counts[2]},{counts[3]}"
        )
    write_gallery(image_paths)


if __name__ == "__main__":
    main()

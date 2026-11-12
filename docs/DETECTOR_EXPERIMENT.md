# Detector experiment

This record selects initial fixed settings for PI-positive object detection. The six supplied
reference counts are now calibration data, so they cannot also serve as independent validation.

## Method

The script [`tools/characterize_images.py`](../tools/characterize_images.py) extracts
`max(0, R - max(G, B)) / 255` from every original JPEG. This suppresses the yellow
magnification stamp without a location-specific crop.

It measures bright connected components (red signal >= 0.25) with equivalent diameters
from 6 to 40 pixels. These size-filtered components can include clusters; their equivalent diameters provide an approximate fluorescent-object size, not a segmented cell-size ground truth. The experiment applies
the radius-to-sigma equation from Voss et al., *DoG Picker and TiltPicker*, equation 4:

```text
sigma1 = radius * sqrt((k^2 - 1) / (2 * k^2 * ln(k)))
sigma2 = k * sigma1
```

The initial exploratory test compares k = 1.6, 3, 4, and 6. The raw positive DoG map is thresholded at 0.04. It keeps
the first pixel in each tied 3x3 local-maximum plateau, sorts candidates by response then y/x,
and suppresses later candidates closer than seven Euclidean pixels. This approximates the Rust detector
selection rule and a 14-pixel target diameter without changing sensitivity through normalization.

SciPy supplies the experiment's Gaussian filter and `imageproc` supplies the browser detector's
filter. They are both separable Gaussian approximations, but are not expected to be bitwise
identical; kernel truncation, borders, and plateau handling can differ. Native/Wasm parity tests own the deployed detector's exact behavior.

## Results

Run from the repository root:

```sh
source source_me.sh && python3 tools/characterize_images.py
```

The experiment prints one reproducible row per supplied image. The measured diameter is a
per-image estimate; the application should use the shared median after the table is reviewed. It
also writes `generated/detector_comparison.jpg`, a six-row gallery of central 800-pixel crops for
k=3, k=4, and k=6. `generated/` is intentionally ignored.

| Image | Diameter px | Bright components | k=1.6 | k=3 | k=4 | k=6 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A101 | 12.9 | 242 | 285 | 438 | 493 | 569 |
| A501 | 11.6 | 243 | 262 | 292 | 299 | 305 |
| C601 | 14.8 | 202 | 228 | 312 | 338 | 362 |
| E401 | 14.4 | 312 | 356 | 539 | 610 | 676 |
| F201 | 14.5 | 808 | 912 | 1368 | 1501 | 1690 |
| H501 | 11.4 | 2223 | 2384 | 2702 | 2789 | 2883 |

The per-image median diameters span 11.4 to 14.8 pixels. The 14-pixel target rounds the
center of that observed range. Candidate counts rise with k on every image.

The generated gallery contains one central 800-pixel crop per original, with k=3, k=4, and k=6
overlays. It shows all candidates
centered on red features, but cannot establish which faint red features are biological cells. The
k=4 overlays retain bright isolated cells and close red pairs without an obvious flood of
background picks; k=6 adds weak points most noticeably in A101, E401, F201, and H501. Use k=4,
target diameter 14 pixels, response threshold 0.04, and seven-pixel suppression for the first
detector implementation. This is a reproducible engineering default, not validated biological
ground truth.

## Exploratory decision

Use a matched DoG with k=4. The initial 14-pixel, 0.04 setting was retained only until
reference-count calibration verified the setting below.

## Reference-count calibration

`docs/REFERENCE_COUNTS.csv` stores the six supplied reference counts. The initial browser
setting of 14 pixels and 0.04 had 31% mean absolute percentage error (MAPE) on this calibration
set.

The following use one shared k=4 setting across all images. Mean absolute error (MAE) is in
objects per image.

| Diameter px | Threshold | A101 | A501 | C601 | E401 | F201 | H501 | MAE |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 0.04 | 636 | 344 | 428 | 840 | 1929 | 3213 | 327.5 |
| 10 | 0.06 | 493 | 337 | 348 | 687 | 1517 | 3122 | 182.2 |
| 10 | 0.08 | 432 | 332 | 320 | 578 | 1284 | 3033 | 96.3 |
| 10 | 0.10 | 377 | 326 | 293 | 523 | 1140 | 2952 | 52.0 |

A local red-signal gate of 0.5 was also tested to remove dim artifacts. It made the result worse:
with diameter 10 and threshold 0.08 it yielded 242, 330, 220, 362, 716, and 3002 (MAE 99.8).
It rejects genuine dim fluorescent objects, so it is not shipped.

The Rust detector verified the calibrated default: target diameter 10 pixels, k=4, raw DoG
threshold 0.10, and five-pixel Euclidean suppression. It produced 398, 339, 296, 546, 1172,
and 3021 detections for A101 through H501, respectively, for 11.6% MAPE. It is one global
setting, with no filename-specific branching. The calibration set cannot independently establish
biological accuracy; future reference images are required for that claim.

## Stability auto-tune

Single-image comparison evaluates the 27 combinations produced by diameter multipliers 0.75,
1, and 1.25; k values 3, 4, and 6; and threshold multipliers 0.5, 1, and 2. For every
candidate, auto-tune calculates the count range along each of its three axis lines, divides
each range by the larger of one and that line's median count, and sums the three normalized
ranges as the stability score. Zero-count candidates are excluded when any candidate is positive;
equal scores favor the candidate nearest the grid center. This creates a reproducible stability choice, then applies
that exact setting to a batch. It measures parameter stability, not biological accuracy.

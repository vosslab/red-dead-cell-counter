# Threshold experiment

## Question

The detector used a fixed raw DoG response cutoff of 0.1. This experiment tested
whether image-adaptive rules improve agreement with the eight supplied calibration
counts while retaining the same diameter (10 px), k (4), local-maximum predicate,
and 5-pixel strict-distance suppression.

The test used the real native Rust `imageproc` Gaussian response, not a Python
approximation. A small native probe also ran the production `detect_core` at 0.1
on every decoded RGBA image. The Python analysis reproduced each returned center
exactly before evaluating any other cutoff. The response map was calculated once
per image; all cutoff rules reused the same ordered centers.

Run it from the repository root:

```sh
source source_me.sh && python3 devel/benchmark_thresholds.py
```

Results and two inspectable center-crop overlays are written to
`generated/threshold_experiment/`. The large temporary RGBA and response buffers
are discarded after each image.

## Rules compared

- Fixed raw thresholds from 0.1 down through the supported minimum 0.00002,
  plus 0.00001 as a historical research diagnostic.
- Whole-map mean plus 2, 3, or 4 standard deviations.
- Whole-map median plus 3, 5, or 8 scaled MAD values, where
  `scaled MAD = 1.4826 * median(abs(response - median(response)))`.
- Otsu and Triangle histogram cutoffs on positive response pixels and separately
  on positive local-maximum scores.

The signed-map MAD rule was intentionally included because it measures the response
background. It fails here: the extremely sparse, near-zero response distribution
makes its scale too small, admitting thousands of weak maxima. The experiment records
an undefined MAD rule if its scale is zero; it does not substitute a hidden floor.

## Results

The fixed 0.1 cutoff had 12.5% mean absolute percentage error across these same
eight calibration images. Otsu on positive response pixels reduced that calibration
MAPE to 8.1%. Its cutoff was rounded to five decimal places before counting and was
image-specific (0.126 to 0.269), generally above
the old fixed cutoff. This is a candidate for the next detector revision, not a
held-out accuracy claim.

| Image | Human count | Fixed 0.1 | Positive-pixel Otsu | Otsu cutoff |
| --- | ---: | ---: | ---: | ---: |
| A101 | 332 | 398 | 326 | 0.14019 |
| A501 | 362 | 339 | 291 | 0.26860 |
| B301 | 235 | 294 | 238 | 0.14598 |
| C601 | 270 | 296 | 264 | 0.13987 |
| E401 | 450 | 546 | 480 | 0.12558 |
| F201 | 1,050 | 1,172 | 992 | 0.13055 |
| H1001 | 745 | 785 | 672 | 0.13869 |
| H501 | 2,997 | 3,021 | 2,456 | 0.26307 |

Otsu undercounts H501 by 541 cells while improving the calibration average. This is
why it should be presented as an evaluated automatic option with its applied cutoff
visible, rather than replacing the current default silently.

The other candidates were materially worse: mean+4 SD gave 24.9% MAPE; Otsu on
peak scores gave 21.2%; Triangle on positive pixels gave 249.9%; the signed-map
MAD variants ranged from 704.6% to 1,609.2%. The full counts, thresholds, and
summary are retained in the generated CSV and JSON outputs.

## Small thresholds and merging

Before the current lower guard was added, the browser/Wasm detector was independently
run at 0.1, 0.001, and 0.00001.
For A501 the counts were 339, 448, and 461. For B301 they were 294, 7,053, and
9,516. The current interface and detector require a threshold strictly greater than
0.00001, so 0.00001 is not a current valid setting; 0.00002 is the smallest value
representable with the five displayed decimal places.

For a fixed diameter and k, threshold outputs are nested: every higher-threshold
center is already present at the lower threshold. Since NMS visits centers in
descending score order, unioning runs at several thresholds is exactly the same as
the lowest-threshold run. The browser check confirmed this identity for A501 and
B301: both unions contained 461 and 9,516 centers respectively.

That differs from the multi-size strategy in the supplied DoG Picker paper. It
processes each size map separately and reduces geometrically overlapping candidates
to the strongest response. A true multi-scale extension could improve physical-size
coverage. Its contract should keep original-pixel coordinates, sort by response then
y/x, and use the existing strict squared-distance predicate when deciding overlap.
It is a separate experiment from threshold merging.

## Decision

Keep manual positive thresholds, including values below 0.001. Do not add same-map
multi-threshold merging or a MAD rule. Otsu on positive DoG response is the only
automatic threshold worth a focused UI/Rust implementation trial: it improved the
available calibration metric and avoided the B301 explosion. Retain the fixed 0.1
baseline and inspect new-image overlays before batch use.

The paper states that DoG maps are normalized before minimum thresholding and that
overlapping candidates from different sizes are reduced to the strongest response.
It does not state the normalization formula, so this experiment does not claim an
exact replication of that part of the paper.

## Area and normalization follow-up

The [BLOB_AREA_EXPERIMENT.md](BLOB_AREA_EXPERIMENT.md) follow-up measures threshold-mask
area and existing center picks on all eight images. Larger blobs often contain multiple
picks, but their area distributions overlap. Blob area can guide a clump investigation;
it cannot establish a biological cell count by itself.

Current upstream Appion source makes an additional normalization experiment reproducible:
[apDog.py](https://github.com/leginon-org/leginon/blob/myami-python3/appion/appionlib/apDog.py)
uses `normStdev(D) / 4`. Its
[imagenorm.py](https://github.com/leginon-org/leginon/blob/myami-python3/appion/appionlib/apImage/imagenorm.py)
defines `normStdev(D)` as `(D - mean(D)) / std(D)`, or mean subtraction for a constant map.
Thus the nonconstant-map response is `(D - mean(D)) / (4 * std(D))`.
This identifies the current implementation, not the exact historical implementation
used in the paper. It is a candidate to test against raw DoG, not an adopted default;
the earlier global mean-plus-SD results already caution against assuming it will improve PI counts.

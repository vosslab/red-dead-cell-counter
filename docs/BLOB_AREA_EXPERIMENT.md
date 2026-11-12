# Blob-area and shape experiment

## Question

Can the area and shape of a thresholded DoG blob help flag fluorescent clumps for a
later automatic detector without treating any blob measurement as a cell count?

## Method

[`devel/measure_blob_areas.py`](../devel/measure_blob_areas.py) runs the native
Rust `imageproc` DoG probe on all eight real calibration JPEGs. It uses the
production baseline settings: 10-pixel diameter, k = 4, raw DoG threshold = 0.1,
and the production local-maximum plus five-pixel suppression rule.

For diagnostic thresholds 0.05, 0.1, and 0.2, it labels **8-connected binary
regions of the raw DoG response**. For every threshold-0.1 region it records
area in pixels, equivalent circular diameter, and how many existing production
detector center picks fall inside it. At threshold 0.1 it also records two mask-shape
measurements: Appion-style roundness `4*pi*A/P^2`, and the ratio of the larger to
smaller eigenvalue of the binary-mask covariance matrix. `P` counts exposed orthogonal
pixel sides, replacing a two-side contribution with `sqrt(2)`, matching
[imagefun.py](https://github.com/leginon-org/leginon/blob/myami-python3/pyami/imagefun.py).
Roundness is a compactness measurement: circles tend toward one and elongated shapes
tend lower. Raster perimeter estimates can exceed one, so the diagnostic does not clamp
them. The inertia ratio is one for an isotropic mask and rises with elongation; it is
undefined when the smaller covariance eigenvalue is nonpositive, as for a single pixel
or an exactly collinear mask.

These are threshold-mask measurements, not raw-red fluorescence area, a physical cell
cross-section, or independent biological truth. The old unused Appion `_moment()` is
intensity-weighted and changes with brightness, so it is not included. The PIK column
named `moment` currently writes roundness.
These are distinct shape measures: roundness depends on perimeter, while inertia depends
on the distribution of area about the centroid. Normalization does not make them equivalent.
The supplied human totals are deliberately not used to select a threshold, fit an
area rule, or judge the number of cells in an individual blob.

Run it from the repository root:

Use the existing Cargo toolchain and Python NumPy, SciPy, Pillow, and scikit-image
environment; the shared threshold-probe helper imports scikit-image.

```sh
source source_me.sh && python3 devel/measure_blob_areas.py
```

It writes per-blob values to `generated/blob_area_experiment/blob_areas.csv` and
per-image/crop summaries to `generated/blob_area_experiment/summary.json`.

## Results

At the baseline threshold, connected blobs are fewer than existing detector picks
in every real image. The difference is evidence that connected-component counting
would merge some detections that the local-peak detector keeps separate.

| Image | Existing detector picks | 0.05 blobs | 0.10 blobs | 0.20 blobs | 0.10 multi-center blobs | Centers in multi-center blobs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A101 | 398 | 477 | 339 | 222 | 42 | 101 |
| A501 | 339 | 292 | 282 | 258 | 40 | 97 |
| B301 | 294 | 311 | 240 | 172 | 40 | 94 |
| C601 | 296 | 318 | 242 | 195 | 38 | 92 |
| E401 | 546 | 570 | 414 | 280 | 93 | 225 |
| F201 | 1,172 | 1,481 | 1,047 | 671 | 107 | 232 |
| H1001 | 785 | 1,010 | 733 | 506 | 49 | 101 |
| H501 | 3,021 | 2,783 | 2,642 | 2,400 | 282 | 662 |

Across all eight images at threshold 0.1, the median mask area was 124 px2 for
single-center blobs and 338 px2 for two-center blobs. Larger blobs generally
contained more existing picks: median area was 551.5 px2 for three centers and
770 px2 for four centers. Area is useful as a clump flag, but cannot be a splitting
rule by itself: 25 multi-center blobs had area at or below the 124 px2 median for
single-center blobs. Threshold changes both mask footprint and fragmentation; H501
has 2,783, 2,642, and 2,400 blobs at 0.05, 0.1, and 0.2 respectively.

Shape differs between the existing pick groups. At threshold 0.1, 5,247
single-center blobs had median roundness 0.930 and median inertia ratio 1.294. The
691 multi-center blobs had median roundness 0.689 and median inertia ratio 3.139.
Only seven multi-center blobs were at least as round as the single-center median, while
61 had inertia ratio no larger than the single-center median. This separates many
bridged or elongated clusters without establishing that an unusual blob contains a
particular number of cells.
These marginal distributions do not establish an improvement beyond area alone;
the planned conditional ablation must test that separately.

The earlier documented difficult regions all formed one threshold-0.1 blob while
containing the existing peak picks below. The H501 screenshot field is a broader
stress case.

| Crop | Existing picks | Binary blobs | Multi-center blobs | Largest area px2 | Roundness | Inertia ratio |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| H501 (513,2299)-(555,2323) | 2 | 1 | 1 | 690 | 0.673 | 5.793 |
| A501 (3670,3314)-(3706,3338) | 3 | 1 | 1 | 556 | 0.698 | 2.751 |
| F201 (2301,3904)-(2338,3931) | 2 | 1 | 1 | 590 | 0.776 | 3.663 |
| H501 (1900,1900)-(2200,2200) | 18 | 14 | 3 | 627 | 0.474 | 16.699 |

## Decision for the automatic-detector investigation

Keep threshold-mask area and roundness as image-derived clump cues. A proposed clump
pass should use them only to decide where to inspect or re-threshold a region; it should
use the existing DoG centers as seed candidates and compare any added or removed centers against
a non-adaptive baseline. The inertia ratio is a second shape cue for the next experiment,
not a third automatic rejection criterion. Test whether it adds information beyond area
and roundness before retaining it. Do not infer a biological count directly from any
shape feature or tune a rule to the eight supplied totals.

The [automatic counting plan](active_plans/active/automatic_image_counting_plan.md)
separates image-specific selection, regional threshold maps, and clump refinement.
Roundness and inertia are research cues here; the deployed detector does not yet use them.

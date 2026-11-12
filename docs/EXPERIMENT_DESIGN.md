# Comparison experimental design

## Question and design

The comparison explores how detector counts respond to diameter, Gaussian ratio k, and
response threshold on the same image. It is a deterministic numerical experiment, not
independent biological measurements.

The comparison accepts an integer run budget from 15 through 100; its default is 21. Its
first 15 settings are a three-factor central composite design:

- One center point.
- Eight factorial points at all combinations of coded -1 and +1.
- Six axial points at plus/minus alpha on one axis, with the other axes at zero.

Alpha is 8^(1/4), approximately 1.68179. Parameters are coded logarithmically. This gives
five levels per parameter, samples farther along each axis, and preserves orthogonal
coded linear main effects for the 15-run core. The quadratic terms are not all mutually
orthogonal. The geometry supports a full quadratic response model, but no fitted optimizer
is shipped.

The default adds six inner-axis points (coded plus/minus 1 on one axis and zero on the
others), labelled `Supplemental`. These make the default 21 runs. They retain useful
one-factor views but make the full 21-run collection neither rotatable nor fully
orthogonal. Budgets above 21 append deterministic Halton-sequence antithetic pairs inside
the same coded cube. Those points are also `Supplemental`: they improve coverage but are
not a claim of a standard rotatable or orthogonal design for arbitrary budgets.

The construction follows the [NIST central composite design reference](https://www.itl.nist.gov/div898/handbook/pri/section3/pri3361.htm).
Repeated center runs are omitted because this detector is deterministic; repeating the
same pixels and settings would not provide independent count information.

## Ranges and bounds

Required automatic refinement uses this design independently on each image. Binary Otsu
first fits a seed threshold at the visible initial diameter/k; the automatic starting
threshold therefore varies by image. The manual threshold entry does not override it.
A no-signal seed returns zero without trials. The seed-plus-design pipeline is provisional;
the eight-image Otsu experiment does not establish its accuracy.

Illustrative manual starting point: diameter 10, k 4, threshold 0.10. The table below
shows that example, not a fixed automatic threshold.

| Parameter | Axial low | Factorial low | Center | Factorial high | Axial high |
| --- | ---: | ---: | ---: | ---: | ---: |
| Diameter px | 5 | 6.62 | 10 | 15.10 | 20 |
| k | 2 | 2.65 | 4 | 6.04 | 8 |
| Threshold | 0.02500 | 0.04385 | 0.10 | 0.22803 | 0.40000 |

Diameter and k normally span half to twice the starting value; threshold spans one quarter
to four times the starting value. Near detector limits, the valid interval is bounded
first and its center is recomputed as the geometric mean. The entire design is then
generated inside that interval. Individual points are not clipped, which would distort
the experimental geometry. The interface reports both the processed starting point and
the actual design center and ranges.

Every generated setting uses the same displayed and executed value: diameter and k round to
two decimals and threshold rounds to five. Thus the actual rounded settings only approximate
the continuous coded geometry. Duplicate rounded settings are rejected while constructing the
design, so every requested run is unique.

Threshold has a 0.00002 lower bound. A raw threshold must be greater than 0.00001 before
rounding, because five decimal places make 0.00002 the smallest valid displayed value. A
starting threshold of 0.0001 explores 0.00003 to 0.00040 after rounding. Inputs that round
outside a parameter's valid bounds are rejected; low-threshold count agreement alone does not
establish that additional detected objects are cells.

## Interpreting and applying results

The table identifies Center, Factorial, Axial, and Supplemental runs. Mean, median, and
population standard deviation describe counts across successful design settings, including zero counts.
Failures are excluded and reported. These statistics depend on the chosen design and range.

For automatic application, select an actual evaluated run whose count is closest to the
median. Ties favor the setting closest to the geometric design center. Its actual count,
settings, and overlay are applied together. This is labeled a representative median run,
not a proven optimum or stable plateau. Users can apply another evaluated row.

The previous axis-line stability score is removed: sparse design points do not provide
complete one-factor slices around every candidate, and missing slices must not be treated
as evidence of stability.

## Verification

- Node checks cover the 15-run CCD core, 21-run default, deterministic unique 100-run
  augmentation, rounded valid settings, threshold rejection, and median selection.
- Browser checks exercise the DoE table, count statistics, applied settings, batch CSV,
  cancellation, and user validation.

Implementations: `src/experiment_design.ts`, `src/choose_representative.ts`, and
`src/refine_image.ts`. Existing test coverage above describes the design and earlier
comparison behavior; current workflow verification is tracked in
[VERIFICATION.md](VERIFICATION.md#required-refinement-workflow).

Real-image coverage and low-threshold measurements are recorded in [DoE results](DOE_RESULTS.md).

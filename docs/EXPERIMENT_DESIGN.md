# Comparison experimental design

## Question and design

The comparison explores how detector counts respond to diameter, Gaussian ratio k, and
response threshold on the same image. It is a deterministic numerical experiment, not
15 independent biological measurements.

The former 3 x 3 x 3 sampler was a full factorial design with 27 settings. The current
comparison uses 15 unique points from a three-factor central composite design:

- One center point.
- Eight factorial points at all combinations of coded -1 and +1.
- Six axial points at plus/minus alpha on one axis, with the other axes at zero.

Alpha is 8^(1/4), approximately 1.68179. Parameters are coded logarithmically. This gives
five levels per parameter, samples farther along each axis, and preserves orthogonal
coded linear main effects. The quadratic terms are not all mutually orthogonal. The
geometry supports a full quadratic response model, but no fitted optimizer is shipped.

The construction follows the [NIST central composite design reference](https://www.itl.nist.gov/div898/handbook/pri/section3/pri3361.htm).
Repeated center runs are omitted because this detector is deterministic; repeating the
same pixels and settings would not provide independent count information.

## Ranges and bounds

Default requested starting point: diameter 10, k 4, threshold 0.10.

| Parameter | Axial low | Factorial low | Center | Factorial high | Axial high |
| --- | ---: | ---: | ---: | ---: | ---: |
| Diameter px | 5 | 6.6223 | 10 | 15.1006 | 20 |
| k | 2 | 2.6489 | 4 | 6.0402 | 8 |
| Threshold | 0.025 | 0.043854 | 0.10 | 0.228027 | 0.40 |

Diameter and k normally span half to twice the starting value; threshold spans one quarter
to four times the starting value. Near detector limits, the valid interval is bounded
first and its center is recomputed as the geometric mean. The entire design is then
generated inside that interval. Individual points are not clipped, which would distort
the experimental geometry. The interface reports both the requested starting point and
the actual design center and ranges.

Continuous diameter values are retained. Rounding them to whole pixels would damage the
coded geometry; Rust already accepts floating-point diameters.

There is no 0.001 threshold floor. A starting threshold of 0.0001 explores 0.000025 to
0.0004. Inputs remain finite and strictly positive; mean count agreement at a low threshold
does not itself establish that the additional detected objects are cells.

## Interpreting and applying results

The table identifies Center, Factorial, and Axial runs. Mean, median, and population standard
deviation describe counts across successful design settings, including zero counts.
Failures are excluded and reported. These statistics depend on the chosen design and range.

For automatic application, select an actual evaluated run whose count is closest to the
median. Ties favor the setting closest to the geometric design center. Its actual count,
settings, and overlay are applied together. This is labeled a representative median run,
not a proven optimum or stable plateau. Users can apply another evaluated row.

The previous axis-line stability score is removed: sparse design points do not provide
complete one-factor slices around every candidate, and missing slices must not be treated
as evidence of stability.

## Verification

- Node checks verify 15 unique points, five levels per factor, zero sums and cross products
  of the coded linear columns, valid bounded designs, low thresholds, and median selection.
- An independent NumPy check gave rank 10 of 10 for the quadratic design matrix; the coded
  linear cross-product matrix was diagonal with entries 13.65685425.
- Browser checks exercise the DoE table, count statistics, applied settings, batch CSV,
  cancellation, and positive thresholds below 0.001.

Implementations: `src/experiment_design.ts` and `src/choose_representative.ts`.

Real-image coverage and low-threshold measurements are recorded in [DoE results](DOE_RESULTS.md).

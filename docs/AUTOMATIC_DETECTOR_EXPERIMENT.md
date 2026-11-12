# Automatic threshold experiment

## Decision and limits

The selected image-specific rule is **binary Otsu on positive DoG pixels**. It ranks first among
the three frozen automatic candidates. Ship it as **provisional**: it improves the existing
0.10000 baseline, but worsens the 0.12000 comparison on this eight-image calibration set.
In particular, the fixed 0.12000 result falls inside all eight human uncertainty intervals;
binary Otsu falls outside three. Automatic processing still estimates a new cutoff from each
image independently; no fixed cutoff, filename lookup, reference-count lookup, or shared batch
cutoff replaces the selected rule.
Every automatic result, including no-signal results, carries native reason
`provisional_calibration`. Local stability does not remove this global review reason.

These are calibration results, not an independent validation or a student study. The approximate
human totals do not provide center annotations. Count error and center-location inspection cannot
establish localization precision, recall, or segmentation accuracy. The eight images influenced
selection of the global rule; the native runtime has no access to their names or totals.

## Frozen computation

- Inputs: all eight original JPEGs in `IMAGES/`, decoded to original-resolution RGBA with Pillow.
  Each image contains approximately 18.1 million pixels; no resizing or image normalization occurs.
- Shared signal: production `max(0, R/255 - max(G,B)/255)` in `f32`; shared production Gaussian
  difference response, diameter 10.00 pixels and k 4.00. The operation order preserves the existing
  manual detector exactly. The response is never display-normalized before selection.
- Histogram: 256 equal-width bins from the finite positive response minimum to maximum, with the
  maximum in bin 255. Bin centers, histogram counts, cumulative sums, and objectives use `f64`.
  Nonpositive response pixels do not contribute to selector fitting.
- Binary Otsu: maximize the sum of squared class sums divided by class weights over two nonempty
  classes. This is equivalent to maximizing between-class variance. Ascending splits and strict
  improvement retain the lowest split on equal objectives. Use the lower class's last bin center.
- Li: initialize at the histogram-weighted mean; update the logarithmic mean of the two class means.
  Stop when the occupied bin partition is unchanged or movement is at most half a bin; limit 100
  iterations. Invalid partitions, invalid iteration, and nonconvergence produce an explicit reason
  and use binary Otsu fitted on the same image.
- Three-class Otsu: maximize the same objective over three nonempty classes; select the lower split
  so the middle and upper classes remain foreground. Ties retain the lexicographically lowest pair.
  An invalid partition uses same-image binary Otsu with an explicit reason.
- Cutoff: round to five decimals, clamp to minimum 0.00002, then convert to `f32`. Production
  selection uses inclusive `response >= threshold`, deterministic 3x3 local maxima, and the
  existing strict half-diameter distance suppression. Manual processing is unchanged.
- Sensitivity: process again at five-decimal-rounded 0.9t and 1.1t, with the same minimum cutoff.
  A count change exceeding 10% of the central count raises `threshold_sensitive`. This is a
  diagnostic about stability, not accuracy. None of these eight binary-Otsu runs raises it.
- Empty positive response or a uniform positive histogram returns empty centers, `no_signal=true`,
  and an explicit reason. Its numeric cutoff originates in Rust and lies above the actual maximum
  response (at least 0.00002), so its saved settings produce an empty mask. Raw cutoffs below
  the minimum raise `threshold_precision_limited`; zero selected centers raise `no_detections`.

The selector definitions follow the documented binary/multiclass Otsu and iterative Li algorithms;
the positive-response domain, frozen bins, stopping rules, tie behavior, rounding, and diagnostics
above define this implementation. See the primary [scikit-image threshold documentation](https://scikit-image.org/docs/stable/api/skimage.filters.html#skimage.filters.threshold_li).

## Reproduction and data order

Run from the repository root:

```bash
source source_me.sh && python3 devel/benchmark_automatic_methods.py
source source_me.sh && python3 devel/render_automatic_crops.py
cargo fmt --manifest-path rust/Cargo.toml --check
cargo check --manifest-path rust/Cargo.toml
cargo test --manifest-path rust/Cargo.toml
cargo clippy --manifest-path rust/Cargo.toml --all-targets -- -D warnings
source source_me.sh && python3 -m pyflakes devel/benchmark_automatic_methods.py devel/render_automatic_crops.py
```

The benchmark builds the native release `automatic_probe`. Each native process receives only an
RGBA file named `input.rgba` and its width/height. It prepares one image, caches one response, and
runs all three selectors and both fixed comparisons. It reports every center in original-pixel
coordinates, actual cutoff, actual fallback method, diagnostic reasons, sensitivity counts, response
time, and per-rule analysis time. No serde or other dependency is added.

Before opening [REFERENCE_COUNTS.csv](REFERENCE_COUNTS.csv), the script writes per-image predictions
and the complete `generated/automatic_threshold_experiment/predictions.json`. The frozen final
prediction SHA-256 is `f86fd859ea083ff7c2006db66f32a435c242d021050b364b5ed0331e87d6979d`.
Its JSON records input SHA-256 hashes and dimensions. Runtime timing changes this artifact hash
on subsequent runs. Only afterward does the script evaluate totals and write `evaluation.csv`,
`summary.json`, and 800-pixel center-crop overlays (`*_chosen.webp`). Full location arrays remain
in the prediction JSON; the crops show only part of each image.

`generated/automatic_threshold_experiment/manifest.json` freezes SHA-256 hashes of the Rust
implementation, both probes, Cargo manifest/lockfile, Python harness, executable, and all eight
input files. The harness verifies the source hashes remain unchanged after inference. The recorded
compiler is `rustc 1.99.1 (58cf8f9c3 2026-10-13)`. The manifest also records two independence checks:
renaming identical A101 RGBA bytes from `input.rgba` to `different_identity.rgba` preserves every
cutoff, method, reason, sensitivity count, and center exactly; doubling every reference total
changes evaluation while preserving the hash of the already-saved predictions. The latter check
does not rerun native inference with an oracle: the runtime has no reference input at all.

`threshold_probe` now borrows the identical prepared response rather than maintaining a second
copy of the signal/blur formula. The production detector, threshold probe, and automatic probe
therefore share the numerical response path. The prepared image releases its old response before
allocating a different scale pair; it does not cache a batch or all trial scales. The existing
finite-setting, exact RGBA length, and 40-million-pixel validation boundaries remain in place.

## Ranking and count errors

For human total H, the allowed interval is `[H/1.1, H/0.9]`. Outside loss is
`max(H/1.1 - count, count - H/0.9, 0) / H`. Center error is `abs(count-H)/H`;
center MAPE averages this error over the eight images. Rank automatic candidates by fewest images
outside the interval, then worst outside loss, then mean outside loss. Exact ties prefer binary
Otsu, Li, then three-class Otsu. The baseline comparisons do not participate in selector ranking.

Measured native release results on 2026-11-12:

| Rule | Outside images | Worst outside loss | Mean outside loss | Center MAPE | Worst center error |
| --- | ---: | ---: | ---: | ---: | ---: |
| Binary Otsu | 3/8 | 10.522% | 2.524% | 8.120% | 19.613% |
| Three-class Otsu, lower split | 7/8 | 46.444% | 23.424% | 33.715% | 57.556% |
| Li | 7/8 | 122.667% | 70.899% | 81.378% | 133.778% |
| Fixed 0.10000 | 4/8 | 13.995% | 4.187% | 12.511% | 25.106% |
| Fixed 0.12000 | 0/8 | 0.000% | 0.000% | 5.188% | 10.213% |

No Li or three-class run falls back on these eight images. All three automatic candidates produce
positive valid cutoffs and finite centers on every image.

| Image | Human H | Binary Otsu t | Binary count | Li t / count | Three-class t / count | Fixed .10 | Fixed .12 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A101 | 332 | 0.14019 | 326 | 0.03436 / 745 | 0.06617 / 494 | 398 | 355 |
| A501 | 362 | 0.26860 | 291 | 0.17087 / 321 | 0.15582 / 323 | 339 | 333 |
| B301 | 235 | 0.14598 | 238 | 0.03613 / 469 | 0.07242 / 335 | 294 | 259 |
| C601 | 270 | 0.13987 | 264 | 0.03718 / 466 | 0.07164 / 338 | 296 | 272 |
| E401 | 450 | 0.12558 | 480 | 0.03055 / 1052 | 0.05996 / 709 | 546 | 495 |
| F201 | 1050 | 0.13055 | 992 | 0.03452 / 2191 | 0.06137 / 1545 | 1172 | 1047 |
| H1001 | 745 | 0.13869 | 672 | 0.03133 / 1435 | 0.06643 / 977 | 785 | 717 |
| H501 | 2997 | 0.26307 | 2456 | 0.17467 / 2755 | 0.16200 / 2800 | 3021 | 2950 |

Binary Otsu loses interval compatibility relative to 0.12000 on A501, H1001, and H501.
The high Otsu cutoffs on A501/H501 exclude weaker red peaks. A histogram class split does not
guarantee a biological cell/background boundary. This regression makes provisional status material;
runtime stability alone does not detect the count bias.

Against fixed 0.12000, A501 loses 12.613% of detections (333 to 291), increasing center error by
11.602 percentage points. H501 loses 16.746% (2950 to 2456), increasing center error by 16.483
points. These are explicit regressions exceeding 10%, despite the smaller local threshold
sensitivity changes. H1001 also loses interval compatibility. No regression threshold is relaxed.

Leaving out each image in turn and reranking the same three rules selects binary Otsu in all
eight cases. `summary.json` records every omitted-image identity and winner. This is a selection
stress diagnostic on the existing calibration data, not independent validation.

## Sensitivity and runtime

Counts and native analysis times for the selected rule:

| Image | At 0.9t | At t | At 1.1t | Response ms | Analysis ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| A101 | 346 | 326 | 304 | 519.3 | 50.19 |
| A501 | 298 | 291 | 285 | 505.4 | 23.75 |
| B301 | 247 | 238 | 232 | 522.8 | 56.73 |
| C601 | 268 | 264 | 255 | 514.4 | 63.22 |
| E401 | 509 | 480 | 456 | 555.6 | 62.28 |
| F201 | 1064 | 992 | 927 | 534.7 | 49.14 |
| H1001 | 703 | 672 | 640 | 518.0 | 60.13 |
| H501 | 2540 | 2456 | 2375 | 516.6 | 32.07 |

Response time includes Rust image validation, red-signal preparation, and the two Gaussian blurs.
Analysis time includes histogram fitting, native center selection, and both sensitivity passes;
it excludes that already-cached response. The fixed baselines perform one center pass and therefore
have less timed work (approximately 4-8 ms here). Python decoding, filesystem transfer, process startup,
printing JSON, Wasm overhead, and browser rendering are outside these native timer spans.
One pass per image is a characterization receipt, not a controlled performance benchmark.

## Location review artifacts

The separate crop renderer reads frozen native centers and verifies each original image hash;
it does not rerun detection or load human totals. Its 13 WebP panels under
`generated/automatic_threshold_experiment/gallery/` align original pixels, fixed-0.10000 markers,
and binary-Otsu markers. The gallery manifest records exact bounds, local counts, prediction hash,
and renderer hash. Five crops cover the established A501/F201/H501 hard regions; eight further
crops show the 512-pixel grid tile with most changed center locations on each image. Equal change
counts select the first row-major tile. Tiny hard crops are enlarged with nearest-neighbor sampling.

The implementer directly inspected three panels: H501's two-lobe hard crop retains two picks;
the H501 hooked-object crop changes from four picks to two while dropping markers from visible
red lobes; A501's most-changed tile changes from seven to four and drops markers at dim red
objects. This is visible loss of signal coverage, not evidence that the removed picks are false
cells. Existing hard A501/F201 crops retain three/two picks respectively; no clump-separation
improvement is claimed. Independent visual assessment remains a separate review responsibility.

## Verification boundary

Focused native tests cover class splitting, the lower multiclass split, deterministic lowest-split
ties, explicit same-image fallback, blank/uniform/nonfinite response diagnostics, precision limiting,
and automatic/manual center equality at the reported cutoff. Existing prepared-image parity tests
exercise changes in diameter, k, threshold, and returning to earlier scales. The first verification
passes all 17 native tests, Cargo check/fmt/Clippy, and the benchmark script's Pyflakes check.

The selected production entry is `PreparedImage.automatic(diameter,k)`, returning an owned
`AutomaticResult`. Its methods return `centers`, actual numeric `threshold`, actual `method`,
`version` (`automatic-dog-1`), `review_reasons`, and `no_signal`; the browser frees the result
after reading it. The other two rules remain available to native research calls only. The manager
owns the serialized Wasm build, generated binding verification, browser parity, and independent
quality review; this native report does not claim those checks have already passed.

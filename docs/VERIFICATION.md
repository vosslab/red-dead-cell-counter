# Verification

Engineering verification performed on macOS with Node 26 and Chromium 158.
These checks do not establish biological counting accuracy.

## Saloon interface

The saloon theme was built and inspected on 2026-11-11. All 13 Chromium workflow
checks passed, including keyboard entry and the existing counting, comparison,
cancellation, CSV, and zoom paths. TypeScript, ESLint, formatting, and the four
experimental-design tests passed. The original 96-image stress test was not repeated.

Rendered entrance and empty-counter checks covered 320, 390, 768, and 1440 pixel
widths. The 768-pixel check used a light system preference; the application retains
its intended dark palette. No page overflow or failed asset requests occurred.
Reduced-motion preference removes door transitions and rotation. An axe scan using
WCAG A/AA tags found no violations on the entrance or populated counter; this is
automated coverage, not a full accessibility audit. A501 still produced 339 detections.

Current WebP captures are [the saloon](screenshots/saloon.webp) and
[the populated counter](screenshots/counter.webp), captured from the production
build served under the repository's Pages subpath and encoded at quality 90.

Editable original artwork is in `src/assets/frontier_saloon.svg` and
`src/assets/longhorn_skull.svg`. SVG XML parsed successfully and was inspected both
with a vector renderer and through the actual page. Construction used semantic
groups, layered primitive forms, and a restrained contour hierarchy. The skill's
local drawing sources were *Generative Art with JavaScript and SVG*, "Grouping and
Reusing Elements", and *A Handbook of Biological Illustration*, the line-weight
passage on emphasizing nearer contours. CSS background composition followed
*Background Magic CSS*, chapters 5 and 8, with current
[MDN reduced-motion guidance](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion).

The supplied Western GUI reference images informed the requested materials and
motifs; the delivered geometry is original and uses no stock artwork or remote fonts.

## Completed checks

- Repository type checking, ESLint, and formatting gate passed.
- Three native Rust tests and Clippy with warnings denied passed.
- Two stability-selection tests passed. The final Chromium regression passed 8/8 in
  11.5 seconds, including comparison-to-batch and automatic tuning workflows. The
  previously passing 96-image stress test was excluded from this repeat run.
- Native and browser Wasm parity fixture returned centers (20,20) and (60,60).
- Release build includes separate main, worker, and Wasm assets; no sample images.
- Browser workflows passed single-image processing, malformed-file continuation,
  CSV settings snapshots, and cancellation checks.
- All six real images completed in the browser and the rendered interface was inspected.
- Repository-subpath smoke test processed A501 as 307 objects in 1.831 seconds,
  including decoding, cold worker initialization, analysis, and preview.

## Browser detector outputs

Settings: diameter 14 px, k 4, raw response threshold 0.04.

| Image | Detections | Human count | Relative error |
| --- | ---: | ---: | ---: |
| A101 | 509 | 332 | +53.3% |
| A501 | 307 | 362 | -15.2% |
| C601 | 344 | 270 | +27.4% |
| E401 | 621 | 450 | +38.0% |
| F201 | 1532 | 1050 | +45.9% |
| H501 | 2817 | 2997 | -6.0% |

These are Rust/Wasm outputs, separate from the SciPy characterization counts.

## Delivered asset sizes

| Asset | Bytes | Gzip bytes |
| --- | ---: | ---: |
| Main JavaScript | 10469 | 3786 |
| Worker JavaScript | 2992 | 1380 |
| Wasm | 42175 | 18910 |

HTML, CSS, and development sourcemaps are additional assets.

## Batch evidence

The serial Chromium workflow suite passed 7/7, including a 96-image batch of the original A501 image with 96 completed result rows and CSV download. The six-original run completed in 6.5 seconds. Exact 96-image timing was not retained.
No browser memory profile or cross-browser run has been completed.

## Reference-guided candidate

The actual Rust/Wasm detector at diameter 10 px, k 4, threshold 0.10 produced
398, 339, 296, 546, 1172, and 3021 objects across A101 through H501. Mean absolute
percentage error is 11.6%, compared with 31.0% for the initial defaults. These
are calibration results on the same six images, not held-out validation.
The six-image candidate run completed in 4.827 seconds under the repository subpath.

## Limits

Human reference counts were supplied after the initial detector was built: A101 332, A501 362, C601 270, E401 450, F201 1050, H501 2997. The initial default has a mean absolute percentage error of 31.0%. These images now form a calibration set; future tuning results on them are not independent validation. The output is a PI-positive object count under the
selected settings. The app is built for GitHub Pages but has not been published.
Full-resolution float buffers require substantial worker memory (hundreds of MB for
these 18-megapixel images); sequential processing bounds the number of active images.

Dependency checks after the latest refresh report zero npm vulnerabilities. A targeted
minimatch >=11.0.8 override fixes GHSA-g3hv-75wg-m249 without downgrading ESLint.
All direct packages were checked against current npm releases; Cargo update resolved no
newer packages. TypeScript 7.0.2 runs the compiler, with the official TypeScript 6 API
compatibility alias for ESLint. A clean temporary npm ci installation succeeded.

## Additional calibration baseline

The unchanged default processed B301 as 294 versus human 235, and H1001 as 785 versus
human 745. Relative errors are +25.1% and +5.4%. All eight calibration images together
have 12.5% mean absolute percentage error. These two images were not used to choose
the existing defaults before this measurement.

The updated eight-image Chromium workflow check passed in 6.1 seconds (6.8 seconds
including runner setup). README/link checks passed 42 tests, and test TypeScript checking passed.

## Comparison feedback and pick inspection

The updated 11-test Chromium regression passed in 15.7 seconds, excluding the previously
verified 96-image stress test. Mean, median, and population standard deviation were
independently checked against the comparison table. Deep zoom, actual-pixel view, fit,
and partial cancellation passed. See [the HCI inspection](COMPARISON_FEEDBACK.md) for
the task model, accessibility findings, and scope of the automated scan.

## Central composite comparison

The current comparison replaces the grid with 15 log-space central composite points.
Four design/selection Node tests and the repository check gate pass. The updated Chromium
regression passed 12/12 in 17.2 seconds (excluding the previously verified 96-image stress
run). A focused repeat confirmed thresholds below 0.001 and valid fractional settings.
README/link checks passed 45 tests. See [design](EXPERIMENT_DESIGN.md) and
[real-image DoE measurements](DOE_RESULTS.md) for coverage and count behavior.

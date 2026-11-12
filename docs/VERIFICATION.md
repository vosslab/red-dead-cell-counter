# Verification

## Frontend responsibility split

On 2026-11-12, `main.ts` shrank from 958 lines to 36 lines of startup and event
wiring. The 436-line controller owns workflows and mutable state; focused modules
own image presentation/export, comparison feedback, worker communication/decoding,
settings, and count statistics. All frontend source files are below the advisory band.
The ownership map is recorded in [DESIGN_DECISIONS.md](DESIGN_DECISIONS.md).

The Pages build, type checking, lint, formatting, and six design tests passed.
All 19 Chromium workflows passed in 19.9 seconds, including real-image counting,
comparison/application, cancellation during decoding and processing, batch CSV,
100-run comparison, modes, zoom/panning, and native/Wasm fixture parity.
Focused repository checks passed 314 cases without the previous source-line warning.
Independent review found no behavior blockers. The detector calculation was unchanged.
The 96-image stress run, performance benchmark, other browser engines, and live Pages
deployment were not repeated for this refactor.

## Prepared-image Wasm performance

The full-resolution 21-run A501/H501 benchmark reduced pooled median elapsed time
from 13.674 to 9.654 seconds (29.4%) while preserving every measured setting and count.
Each comparison transfers one RGBA image instead of 21 (95.2% fewer image bytes), and
Rust reuses the latest DoG response for consecutive threshold-only trials.
The release build, seven native tests, Clippy, and all 19 Chromium workflows passed.
See [WASM_PERFORMANCE.md](WASM_PERFORMANCE.md) for the runtime contract, memory cost,
reproduction commands, package sizes, and measurement limits.

## Single-image and batch modes

- Built the Pages package and passed type checking, lint, formatting, and six DoE
  behavior checks. All 18 Chromium workflow checks passed in 20.4 seconds, including
  all eight real originals, automatic comparison, single-to-batch settings handoff,
  two-file preservation, CSV export, cancellation, zoom, tabs, and drag panning.
- Verified native radio keyboard selection, busy-state mode disabling, and both
  explicit handoffs. Two selected File objects, their counts, and the chosen settings
  survived switching modes. A separate real-image check confirmed Single image Cancel.
- Both modes rendered without page overflow at 320, 480, 768, 1024, 1440, and 1920
  pixels. Axe-core 4.14.0 found zero requested WCAG A/AA violations across the inspected
  empty, counted, and comparison-result states in both modes. No JavaScript errors
  occurred. An independent agent review found no workflow blockers.
- Refreshed Single image and comparison screenshots, and added a Batch screenshot
  to the README. The task model and acceptance ledger are in
  [WORKFLOW_MODES.md](WORKFLOW_MODES.md); raw captures/scans are under
  `/private/tmp/red-cell-experiment/workflow_modes/` and `workflow_modes_final/`.
- The focused repository checks passed 286 cases. The line-count check warns that
  `src/main.ts` has 955 lines, below its 1000-line limit; mode behavior is kept in
  `src/workflow_modes.ts`. The 96-image stress run, other browser engines, participant
  testing, and the deployed Pages revision were not rechecked.

## Compact workbench header

- The header uses the full product name, one subtitle, a small skull, and tighter
  spacing. At 1440 pixels wide its height dropped from 181.9 to 89.4 pixels, and the
  viewer's document position moved from y=558.2 to y=457.7. At 320 pixels the header
  dropped from 242.0 to 112.9 pixels.
- Built the Pages package and passed the two focused entrance/count/CSV browser checks.
  Inspected renders at 320, 480, 768, 1024, 1440, and 1920 pixels without page overflow.
  Axe-core found zero requested WCAG A/AA violations on the populated counter; no browser
  JavaScript errors occurred. The README counter screenshot was refreshed.
- The illustrated saloon entrance was preserved. Raw measurements and screenshots are
  in `/private/tmp/red-cell-experiment/header_before/` and `header_after/`.
  Live Pages deployment was not checked.

## Drag-to-pan follow-up

- The Pages build, type checking, lint, formatting, and six experiment-design checks
  passed. All four focused Chromium checks for zoom, preview tabs, delayed preview
  replacement, and drag panning passed.
- A real A501 crop verifies both pan axes in Raw/DoG/Threshold, cursor feedback,
  continued movement beyond the viewport, retained pan across tabs, release and blur
  cleanup, and native keyboard scrolling. Touch input stays with the browser's native
  gesture handling; physical touch hardware and live Pages deployment were not checked.

## Workbench UX follow-up

- The product-name correction to Red Dead Cell Counter passed the two focused
  entrance/count/CSV browser checks. The updated title fit at 320, 768, 1024, and
  1440 pixels without page overflow, and the counter screenshot was refreshed.
- Built the Pages package and passed type checking, lint, formatting, and six DoE checks.
- The 17-test Chromium regression passed, including the eight real images and a new
  keyboard workflow covering selected-image context, stale controls, batch completion,
  comparison statistic highlights, and return-to-inspection focus. Four affected
  workflow/viewer checks passed again after final target-size styling.
- Axe-core 4.14.0 found zero requested WCAG A/AA violations in the inspected empty,
  selected, and completed comparison states. Final renders had no page overflow at
  320, 480, 768, and 1920 pixels; a long filename also fit at 320 pixels.
  Additional 900/1024/1100/1280 checks passed after correcting tablet control overflow.
- The desktop masthead shrank from 314 to 182 pixels and the viewer moved from y=729
  to y=558 at 1440 x 1000. Touch controls retain a 44-pixel minimum height.
- See [COMPARISON_FEEDBACK.md](COMPARISON_FEEDBACK.md) for the task model, heuristic
  ledger, state checks, raw evidence locations, and scope limits. The 96-image stress
  run, other browser engines, participant testing, and live Pages deployment were not
  rechecked. This UI follow-up did not alter the detector calculations.

Engineering verification performed on macOS with Node 26 and Chromium 158.
These checks do not establish biological counting accuracy.

## Raw, DoG, and Threshold viewer

The viewer update passed all 16 Chromium workflows in 19.6 seconds, including
real-image RGB/grayscale/binary rendering, manual keyboard tab activation, shared
zoom, stored applied settings, and delayed-preview cancellation on source changes.
Five native Rust tests, all-target Clippy, and the TypeScript/lint/format/design
checks passed. All eight supplied images still completed through the browser worker.

Native and Wasm previews of the same 80-by-80 fixture produced identical FNV-1a
checksums: DoG 4040210429 and Threshold 2186775013. The threshold plane uses the
original float DoG response at or above the cutoff, before display contrast scaling.

The full-resolution A501 views were inspected on the same irregular fluorescent
object at 1000% fit (about 2x original pixels). Cold DoG display took about 1.4 s
including the screenshot step; the cached Threshold switch took about 0.13 s.
These are observations, not timing guarantees. The native image dimensions and
alignment were retained in all three views. The [viewer screenshot](screenshots/viewer_views.webp)
shows the actual rendered views with markers switched off.

The final Threshold-view axe scan reported zero requested WCAG A/AA violations.
Widths 320, 390, 768, and 1440 had no page overflow. No live Pages deployment,
cross-browser run, memory profile, or repeat of the 96-image stress test was performed.

## Rounded comparison settings and run budgets

The latest Chromium regression passed all 14 workflows in 21.6 seconds. This
includes a 100-run experiment on a real 128-pixel A501 crop, strict threshold
rejection at 0.00001, successful runs from 0.00002, rounded applied-settings/CSV
agreement, table statistics, and comma-separated counts. The six design tests
cover every budget from 15 through 100, including valid unique settings near the
lower bounds. TypeScript, lint, formatting, three native Rust tests, and Clippy
passed. Focused documentation, ASCII, and Python lint checks passed 207 tests.

A full-resolution H501 comparison completed 21 settings in about 15 seconds:
counts 1,484-5,245, mean 3,060.4, median 3,021.0, and population SD 872.6.
The [comparison screenshot](screenshots/comparison.webp) shows those statistics
below the Count column. This spread describes parameter sensitivity.

Final rendering checks found no page overflow at widths 320, 390, 768, and 1440.
A loaded-image panel sizing issue was corrected. The completed comparison's
recommended-row label initially measured 3.97:1 contrast; a hue-preserving gold
adjustment from `#d8ad58` to `#e8d09e` gives 5.52:1 against `#73421e`.
The final axe scan reported zero violations for the requested WCAG A/AA tags.
All three README WebP captures were refreshed from this build at quality 90.

The 96-image stress test was not repeated. Automatic-threshold calibration
evidence and limitations are in [the threshold experiment](THRESHOLD_EXPERIMENT.md).

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

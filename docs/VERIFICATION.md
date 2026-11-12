# Verification

## Automatic image counting

The eight-image comparison selected one global binary Otsu method for automatic
counting. The method is provisional because its per-image quality classifications
do not meet the fixed 0.10 baseline; fixed 0.12 is not a runtime fallback. Under
the `[H/1.1, H/0.9]` classification interval, automatic Otsu has 3/8 images
outside, fixed 0.10 has 4/8, and fixed 0.12 has 0/8. This is calibration-corpus evidence, not
independent biological validation. The independent specification review is
`automatic_threshold_selection_review`; native quality acceptance covers 17 Rust
tests (15 unit and 2 integration).

The final canonical Pages build passed in 1.2 seconds at 14:13:50. Wasm is
57,536 raw / 25,643 gzip bytes, SHA-256
`a56984447184a7a2445e0b8eec7848a5855bf5b1fa35afff2d3925e71bfbdb59`; main JS is
35,894 / 11,616 bytes and worker JS is 7,778 / 2,819 bytes. The ten-file sorted dist hash manifest digest is
`afa33741db240b8f73e345cef49e78094a8df8d40324c4abb82f14a9ae4cb312` (636,974 total
raw bytes); full manifest: `/private/tmp/automatic_dist_manifest_final.log`.
Build log: `/private/tmp/automatic_pages_build_final.log`. The six DOE checks in
`./check_codebase.sh` pass. Fresh full pytest passed 1,155 cases in 2.22 seconds
(`automatic_rebuild_final`); a focused 141-case repository run also passed after
a one-line import-boundary repair.

Native/Wasm boundary quality re-review accepts nine real-Wasm cases plus mocked-client
cases. Built-browser parity matched all eight real-image center arrays and selected
cutoffs: A101 326, A501 291, B301 238, C601 264, E401 480, F201 992, H1001 672,
and H501 2,456.
The 17/17 browser regression passed in 18.4 seconds and checked all 5,719 center pairs.
A heterogeneous browser stress run repeated the eight originals twelve times and
completed all 96 rows. Counts, actual five-place cutoffs, method/review status, and
completion state match native results. Start-to-CSV took 70,812 ms. The run is
throughput evidence, not 96 independent samples. Receipts:
`/private/tmp/automatic_stress_final.log`,
`/private/tmp/automatic_stress_results.json`, and
`/private/tmp/automatic_stress_96.csv`. The first harness attempt exceeded
Playwright's 50 MB input limit before the app ran; the corrected repeated-file-path
harness passed.

The frontend specification report found a queued-status issue and the fix passed fresh
specification re-review. Accessibility review measured 4.3906:1 hover contrast on the
primary button at 320 px before correction. A CSS-only color correction was built in
READY3. Build log: `/private/tmp/automatic_pages_build_release.log`;
source CSS SHA-256 `efe2d1472201f3e366c277f4fc3031c50a00b20630196d44a2cc93cc1e87c6cd`.
JS and Wasm are unchanged, so the 17 Rust tests remain applicable.
After the CSS change, all five quality-90 real-image WebP captures were refreshed and
inspected as clear and readable. The 21-run comparison completed 21/21 with mean 347.7,
median 338.0, and population SD 95.2; A501 automatic count was 291 and marked
provisional. Final build log: `/private/tmp/automatic_pages_build_release.log`; final
dist manifest `/private/tmp/automatic_dist_manifest_css733.log`, digest
`66078346ad7a563e51fae03f95d041951f5fcf01f0a5e0b30568c376ff93acb6`.
The independent final accessibility review accepts: nine Axe scans found zero
violations across 12 states at widths 320, 480, 768, and 1920 px, with no overflow.
Primary-button hover contrast is 5.1536:1, 5.4711:1, 5.5048:1, and 5.4336:1 at those
widths. Keyboard, recovery, CSV, and the 15-selection DOE workflow pass. A minor
Advanced completion-focus issue is documented as non-blocking. The historical
comparison-feedback documentation fix also passes 57 link checks. Final integration
acceptance is recorded in [the independent integration review](active_plans/reports/automatic_integration_review.md),
which found no blockers; five local links and ASCII compliance passed. These receipts
establish engineering behavior on calibration images; they do not establish independent
biological accuracy, student usability, or live Pages publication.

## Adaptive blob experiment

On 2026-11-12, complete the six-policy research experiment described in
[ADAPTIVE_BLOB_EXPERIMENT.md](ADAPTIVE_BLOB_EXPERIMENT.md). Its 144 cases cover eight real
JPEGs at base cutoffs 0.08, 0.10, and 0.12, with 48 default and 96 nearby results. Every
adaptive candidate fails the frozen retention rule. Independent specification, quality,
compactness, inertia, selection, and visual assessments accept the negative result.
The detector keeps diameter 10 px, k=4, cutoff 0.10; no adaptive policy or interface ships.
The existing geometry port below is a distinct earlier deliverable.

The final benchmark command is:

```sh
source source_me.sh && python3 devel/benchmark_adaptive_blobs.py
```

It exits 0, with all eight P/default center arrays exactly equal to native Rust. The final
manifest's nine source and eight input SHA-256 hashes match current files. The source freeze
follows the float32 comparison correction; the corrected rerun changes zero saved outputs.
An independent audit checks all 144 saved cases and 106,944 parent CSV rows, accounting for
emitted centers. A renamed real A101 input reproduces native and all-policy output; real-crop
copies with reversed center/policy order reproduce masks, decisions, and centers. The ignored
`generated/adaptive_blob_experiment/verification.json` stores that separate audit receipt.

The final run takes 38.55 seconds; Python high-water RSS is about 1.24 GB and child high-water
RSS is 364.53 MB (decimal units, measured separately). Per-policy timings share caches and
depend on order, so they are not a speed comparison. The report defines generated artifacts,
regeneration, frozen rules, all count/loss tables, rejection reasons, and the preserved crop.

Final automated checks pass:

| Command or lane | Result |
| --- | --- |
| `source source_me.sh && python3 -m pytest tests/ -q` | 1,115 passed in 1.93 seconds after closeout. |
| `source source_me.sh && python3 -m pytest tests/test_pyflakes_code_lint.py -q` | 50 passed. |
| Executable/shebang lane | 171 passed after restoring two existing verifiers' executable modes. |
| `./check_codebase.sh` | TypeScript type/lint/format plus six DOE checks pass. |
| `cargo test --manifest-path rust/Cargo.toml` | 12 Rust tests pass. |
| `WASM_PACK_CACHE=/Users/vosslab/.cache/wasm-pack ./build_github_pages.sh` | Pages-ready build passes. |

The focused Chromium command passes five workflows in 9.2 seconds:

```sh
source source_me.sh && PLAYWRIGHT_BROWSERS_PATH=/Users/vosslab/.cache/ms-playwright PW_PORT=4189 npx playwright test --workers=1 --grep 'all supplied images|researcher can count|prepared worker image|production worker measures|viewer tabs retain'
```

This exercises all eight real images in the browser worker, real CSV, prepared-image reuse,
blob measurements, and actual Raw/DoG/Threshold views. It does not rerun the historical full
21-workflow suite. The first full pytest run records 1,126 passes and two executable-mode
failures; restoring the verifier modes and removing temporary checks yields the final 1,115.
Two permanent checks protect the observed float32 boundary regression and inclusive
uncertainty-band/loss semantics. Sixteen temporary implementation proofs pass before removal.
After the report and records are written, Markdown links, ASCII/ISO-8859-1 compliance, and
source-file length checks pass 340 checks; `git diff --check` is clean. The preserved H501
WebP is byte-identical to its generated source crop.

The image assessor inspects eight real WebPs from 46 generated crop panels. The durable
H501 example loses visible lobes' markers and mask coverage during four-to-one consolidation;
the known hard H501/A501/F201 clumps remain unresolved. Uncertain ImageJ totals and qualitative
inspection establish neither localization accuracy nor mask quality. No adaptive Rust/Wasm
port or biological validation is claimed. M14-M17 are N/A. The fresh
`adaptive_integration_review` accepts M18 with no blockers after auditing all 144 cases, 106,944
parent rows, 46 gallery assets, nine source and eight input hashes, the exact curated H501 image,
and independent gate computations rejecting every policy. It did not rerun the benchmark,
browser workflows, Pages build, or native checks; their scoped receipts above remain the evidence.
ImageJ references remain uncertain and are not independent biological validation. See
[adaptive_blob_processing_progress.md](active_plans/active/adaptive_blob_processing_progress.md).

## Rust/Wasm blob measurements

On 2026-11-12, ported binary-mask blob geometry to portable Rust and the production
Pages worker. [BLOB_MEASUREMENTS.md](BLOB_MEASUREMENTS.md) specifies eight-connectivity,
nonzero foreground, field order, error handling, Appion-style roundness, and binary
covariance inertia ratio. The new routine is available to browser callers; existing
cell counts, scalar thresholds, previews, and manual comparison behavior remain unchanged.
It does not yet select an automatic detector or use shape to accept/reject cells.

The Python experiment measured all eight real calibration images at raw DoG cutoff
0.1. One-pick blobs had median roundness 0.930 and inertia ratio 1.294; multi-pick blobs
had medians 0.689 and 3.139. These groups contain existing detector picks, not independently
labeled cells. The full area/shape receipt is [BLOB_AREA_EXPERIMENT.md](BLOB_AREA_EXPERIMENT.md).

Python, native Rust, and the final Chromium worker agreed across all 5,939 components
in the eight full-size real-image masks. Anchors and areas matched exactly; centroids
used absolute tolerance 1e-7 pixels, equivalent diameter/roundness used relative 1e-8,
and inertia ratio used relative 1e-6. Degenerate inertia stayed undefined/NaN. The worker
test also verifies the Float64Array payload, connectivity, geometry, and invalid-mask error.

Reproduce the native oracle and temporary masks with:

```sh
source source_me.sh && python3 devel/verify_blob_features.py
```

Build using `WASM_PACK_CACHE=/Users/vosslab/.cache/wasm-pack ./build_github_pages.sh`,
serve the repository root on localhost port 4188, then run:

```sh
PLAYWRIGHT_BROWSERS_PATH=/Users/vosslab/.cache/ms-playwright node tests/playwright/verify_blob_features.mjs http://127.0.0.1:4188
```

The harness opens the actual `/dist/` worker, records ignored metrics under
`generated/blob_feature_parity/`, and removes its large temporary mask files. This run
measured worker mask geometry at 10.6-21.8 ms per image; rAF intervals had median and
maximum 16.7 ms. These are single-run advisory measurements of mask geometry, excluding
JPEG decoding and DoG filtering, not an end-to-end detector speedup or cross-browser claim.

The release artifact grew modestly:

| Artifact | Previous raw / gzip bytes | Blob port raw / gzip bytes |
| --- | ---: | ---: |
| Wasm | 45,911 / 20,666 | 50,455 / 22,813 |
| Worker JS | 4,371 / 1,864 | 4,940 / 2,024 |

Pages build, type/lint/format checks, six design tests, 12 Rust tests, Clippy, and 482
focused repository checks passed. All 21 Chromium workflows passed with one worker
(including the 96-image baseline batch). The first seven-worker run had six startup/timeouts;
all six passed unchanged with one worker, followed by the complete one-worker pass.
The failed snapshots showed the saloon button still disabled before main.js enabled it;
that startup path never invokes the detector worker. The parallel serving/startup cause
was not conclusively isolated, so this receipt does not claim a clean parallel run.

The [automatic counting plan](archive/automatic_image_counting_plan.md)
contains 27 atomic milestones with one owner each and acyclic dependencies. It separates
image-specific and regional thresholds, recursive clumps, multi-scale DoG, watershed,
and one conditional hybrid comparison. Additional annotations are a validation gap,
not a human gate. This turn implemented the measurement primitive and investigation
tools; the later automatic-selection/student-workflow milestones remain planned.
No independent biological accuracy, live deployment of this revision, or other browser
engine was verified.

## Processing-guide clarification

On 2026-11-12, replaced the three similar viewer screenshots with a labeled
1280 x 1280 processing guide. All four panels use the same 300 x 300-pixel H501
crop at (1900, 1900), rendered by the actual app with diameter 10, k 4, and cutoff
0.10000. Raw fluorescence, the contrast-stretched DoG response, and the binary mask
lead to a fourth panel with the actual green detection rings. Repeated viewer controls
were removed. The labels distinguish candidate pixels from the final picked centers.
This guide replaces the earlier A501 triptych listed in the capture receipt below.

The updated capture harness refreshed all five managed assets, retained the real H501
3,021 and A501 339 counts, checked batch CSV, and confirmed a live Pages A501 count of
339. Full-crop assertions verified raw color, intermediate grayscale DoG values, a
binary threshold mask, and green rings only in the final panel. Capture waits for the
asynchronous overlay redraw before reading pixels. The final guide is quality-90 WebP,
71,610 bytes; its labels, joined-object example, and final centers were visually inspected.
An independent review found the explanation consistent with the detector behavior.

Type/lint/format checks, six design tests, and 312 focused repository checks passed.
No application or detector code changed. The application build, native Rust tests,
full browser suite, and student usability study were not repeated for this figure fix.

## Biology-student README and captures

On 2026-11-12, the README was refreshed with `readme-docs` and `screenshot-docs` for
biology students: a no-install browser path, a downloadable real H501 example, plain
parameter explanations, and an optional pick-inspection exercise. Developer commands
remain in a disclosure. The seven primary documentation routes include the new
[SCREENSHOTS.md](SCREENSHOTS.md) visual tour.

An independent editorial review scored the page 93/100 before and 99/100 after the
refresh, using the README skill rubric. The largest gain was meaningful first success
(11 to 15): the student can save H501, compare 21 settings, and inspect the applied
3,021 detections. This is an editorial assessment, not evidence from student participants.
The opening is 235 characters, local links and examples resolve, and calibration limits
appear before the first-use steps. License wording now identifies the MIT text while
explicitly noting its unfilled copyright attribution, rather than inventing attribution.

The capture backend is Playwright/Chromium against the local production Pages build.
Five refreshed WebPs use quality 90, remain within the 1920-pixel edge limit, and are
under 1 MB each. The hero is a deliberate image-panel crop with visible filename,
count, controls, and red cells with green detection circles. The comparison capture
includes its statistics and table headers. The three-view image uses completed render
states and pixel checks to distinguish raw color, grayscale DoG, and binary Threshold.

| Asset | Dimensions | Captured state |
| --- | --- | --- |
| `saloon.webp` | 1440 x 900 | Saloon before image selection |
| `counter.webp` | 1440 x 1050 | H501, 3,021 detections, zoomed inspection |
| `batch.webp` | 1440 x 900 | H501 3,021 and A501 339, both complete |
| `viewer_views.webp` | 1920 x 900 | Same real A501 region, Raw/DoG/Threshold |
| `comparison.webp` | 1440 x 850 | H501's 21-run result and count statistics |

All encoded images were visually inspected. The batch CSV path was checked separately,
including its filename and both real count rows. All five managed assets have live
embeds; none were pruned and no historical reference images were added. Managed blocks
in the README and visual tour retain their sentinels, relative paths, and descriptive
alt text. Static images suit the detailed cell/parameter inspection; no animation is used.

The live [Pages tool](https://vosslab.github.io/red-dead-cell-counter/) returned HTTP 200,
opened the saloon, accepted A501, and returned 339 detections. The public H501 sample
download also returned HTTP 200. This confirms the live first-use route, without
asserting that it runs the same revision as the local capture build.

To refresh the captures, build and serve in one terminal:

```sh
WASM_PACK_CACHE=/Users/vosslab/.cache/wasm-pack ./build_github_pages.sh
source source_me.sh && python3 -m http.server 4188 --bind 127.0.0.1 --directory dist
```

In a second terminal:

```sh
PLAYWRIGHT_BROWSERS_PATH=/Users/vosslab/.cache/ms-playwright node tests/playwright/capture_readme.mjs http://127.0.0.1:4188/
```

The harness writes temporary PNGs and encoded intermediates under
`/private/tmp/red_dead_cell_counter_readme/`, copies the final WebPs to `docs/screenshots/`,
and records capture times, dimensions, bytes, real counts, and live checks in ignored
`generated/readme_screenshot_capture.json`, the current-run timestamp authority.

The Pages build, type/lint/format checks, six design tests, seven native Rust tests, and
318 focused repository checks passed. The optional Python characterization command's
help path and imports also worked. Dependency installation steps were inspected against
the existing manifests and successful local build; no fresh reinstall was needed.
The full 19-workflow suite passed immediately before this documentation-only change
and was not repeated. No cross-browser or student usability study was performed.

Non-blocking metadata follow-up: the maintainer owns completing the actual copyright
attribution in `LICENSE.MIT`. Evidence is its existing `[year] [fullname]` line; completion
means verified attribution replaces those fields and the README matches it. No licensing
or ownership terms were inferred for the contributed calibration images.

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

- After plan archival, full pytest passes 1,155 checks; final static gate passes both TypeScript
  checks, ESLint, Prettier and six DOE tests. Test-discovery ordering fix is covered by one
  focused regression; SPEC and QUALITY reviews accept.

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

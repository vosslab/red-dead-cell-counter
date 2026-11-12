# Changelog

## 2026-11-12

### Additions and New Features

- Added [WALKTHROUGH.md](WALKTHROUGH.md), a guided Choose images, Count cells,
  inspect, and CSV workflow with processing-view explanations, a touching-cells
  exercise, partial-result handling, and optional selected-image Advanced analysis.
- Implemented image-by-image automatic counting with a binary Otsu cutoff fitted to
  each image's positive DoG response in shared native Rust/Wasm. Saved results include
  the actual cutoff, method/version, automatic/manual mode, and review reasons;
  every automatic result is marked provisional after eight-image calibration.
- Added a beginner path from the saloon's Choose images action to Count cells,
  marker inspection, and one-file or partial CSV export. Try an example lazily loads
  and counts real A501 pixels through the same pipeline. Advanced manual analysis and
  15-100-run comparison affect only the selected image.

- Added a reproducible six-policy adaptive-blob research harness and
  [ADAPTIVE_BLOB_EXPERIMENT.md](ADAPTIVE_BLOB_EXPERIMENT.md). Saved 144 real-image cases,
  106,944 parent decisions, and 46 comparison crops; preserved one visible consolidation
  failure as a durable WebP example. Human ImageJ totals enter only after detection.

- Completed the authorized adaptive blob-processing experiment under its frozen 18-milestone plan.
  The measured decision is negative: milestones M14-M17 are not applicable, and no adaptive policy
  passed the independent gates. The completed report records the evidence and limitations.

- Ported eight-connected binary blob measurements to Rust/WASM and exposed them through
  the production worker: area, centroid, equivalent diameter, Appion-style roundness,
  and binary covariance inertia ratio. Added Python/native/browser parity tools.
- Added a reproducible native-Rust-response blob diagnostic on all eight real calibration
  images. Recorded connected-mask areas, equivalent diameters, roundness, binary inertia
  ratios, and existing peak memberships without treating them as biological ground truth.
- Drafted an experiment-first automatic-counting plan with independent regional and
  clump-refinement arms, per-image batch results, advanced manual controls, and a complete
  manager/subagent execution path that does not require human labels or approval gates.

### Behavior or Interface Changes

- Reworked the README into a shorter visual front door with three focused workflow
  screenshots, native captions, and links to the detailed walkthrough. Preserved the
  Western identity, provisional status, credits, and local build commands; moved
  supporting developer commands into [USAGE.md](USAGE.md).
- Align the four Advanced tuning inputs in equal columns on wide screens, with two-column
  and single-column layouts on smaller screens. Shared label, input, and helper rows keep
  the entry boxes aligned when text wraps.

- Infer single-image or batch scope from the selected file set. Count cells adjusts
  each image independently; Advanced diameter/k changes affect later runs. Preserve
  completed and previously saved counts through cancellation or failed recounts,
  with explicit prior-result labels and actual saved provenance in the viewer and CSV.

- Updated beginner documentation to Choose images, Count cells, inspect markers, and
  Download CSV. Documented real-example loading, per-image automatic thresholds,
  selected-image Advanced research, partial exports, and saved-analysis provenance.
- Added usage, architecture, and file-structure references for the shared native/Wasm
  numerical path. Kept calibration limitations visible and linked the automatic-method
  experiment without treating uncertain ImageJ totals as independent validation.

- Reworked the README for biology students with a browser-first H501 walkthrough,
  plain-language detector controls, an inspection exercise, and a separate visual tour.
  Kept calibration evidence and moved developer setup into an optional disclosure.
- Refreshed five real-image interface screenshots and added a reproducible capture
  harness. The README now leads with a zoomed H501 count and detection overlay.

### Fixes and Maintenance

- Skip deleted worktree paths before content-reading hygiene filters, so archived plans can be
  checked without staging Git changes.

- Fixed manual comparison requests whose design-point kind overwrote the worker's
  detect message kind, causing every trial to fail. Clear/free prepared worker state
  before validating replacement pixels so a rejected replacement cannot reuse an old image.

- Corrected the experimental runner's float32-inclusive cutoff comparison at 0.08/0.12.
  The complete corrected rerun changes zero experiment outputs. Restored executable modes
  on the existing Python and browser blob verifiers after full-suite failures exposed them.

- Protected diagnostic CSV filenames from spreadsheet formula interpretation and added
  explicit geometry, shape-direction, and translation self-checks.
- Replaced the repetitive three-view screenshot with a labeled four-stage H501 guide,
  including the final picked centers. Removed repeated controls and explained that
  thresholded white regions are candidate pixels rather than cell counts.
- Reduced `src/main.ts` from 958 lines to a 36-line startup and event-wiring module.
  Separated workflow coordination, worker requests and image decoding, image results
  and CSV export, comparison presentation, settings validation, and count statistics.
  Preserved existing detector settings, prepared-image reuse, and user workflows.

### Developer Tests and Notes

- For the visual documentation refresh, inspected three focused workflow crops and
  refreshed eight interface assets from the local build. Checked 77 local links and
  image targets across six edited documents, ASCII source, screenshot sentinels,
  and the 208-character plain opening. README displays its three crops at 520 px;
  walkthrough views use 720-760 px. The user owns testing for this refresh, so no
  test suites were run. Local captures do not verify the deployed revision.

- Recaptured all five managed WebP screenshots at quality 90 from the corrected local
  production build. Verified the real A501 example (291 cells, cutoff 0.26860), H501
  (2,456, cutoff 0.26307), per-row automatic CSV metadata, 21 successful Advanced
  comparison trials, and distinct actual Raw/DoG/Threshold/marker pixels. Inspected
  the final images and the README views at 880 px; 62 focused documentation checks pass.
  This capture does not verify the public deployment or biological accuracy.

- The final adaptive experiment runs in 38.55 seconds with about 1.24 GB Python high-water
  RSS and 364.53 MB child high-water RSS, measured separately. All eight default P center
  arrays match native Rust exactly; independent case/CSV and rename/order audits pass.
- The final integration review accepts M18 with no blockers after auditing all 144 cases,
  106,944 parent rows, 46 gallery assets, nine source and eight input hashes, the exact curated
  H501 image, and independent gate computations rejecting every policy. The reviewer did not
  rerun the benchmark, browser workflows, Pages build, or native checks.
- After closeout, the retained pytest suite passes 1,115 checks; pyflakes passes 50 and
  executable/shebang checks pass 171. TypeScript type/lint/format, six DOE checks, 12 Rust
  tests, the Pages build, and five focused Chromium checks pass. Kept two meaningful
  regressions and removed 16 passing temporary implementation proofs. ImageJ references
  remain uncertain and are not independent biological validation; the broader automatic-
  counting plan remains open.

- Matched Python, native Rust, and the production Chromium worker on 5,939 blobs from
  all eight real-image masks. Passed 12 Rust tests, Clippy, code checks, six design tests,
  482 focused repository checks, and all 21 browser workflows with one worker.
  The initial seven-worker run had startup stalls; the serial rerun passed unchanged.
  Blob measurements add 2,147 gzip bytes to Wasm and 160 to worker JS; counts are unchanged.
- Checked the automatic plan's 27 milestone IDs, one-owner mapping, observable checks,
  and acyclic dependencies. New labels are not required to finish the engineering plan;
  independent biological validation remains a stated limitation.
- Recaptured all five managed assets and checked the four-stage guide's actual pixel
  planes and final green overlays. Real-image counting, batch CSV, and live A501
  analysis passed; code checks, six design tests, and 312 focused repository checks
  passed. An independent review confirmed the guide matches detector behavior.
- Verified the student walkthrough with real H501/A501 processing, batch CSV export,
  distinct Raw/DoG/Threshold renders, and a working live Pages A501 count of 339.
  All five refreshed screenshots passed visual and size checks. Independent README
  review improved from 93/100 to 99/100, chiefly through the first-image path.
  The Pages build, code checks, seven Rust tests, and 318 focused repository checks passed.

- Passed the Pages build, type/lint/format checks, six design tests, all 19 Chromium
  workflows, and 314 focused repository checks. The source-line warning is resolved;
  independent review found no behavior blockers. No new dependencies were added.

### Decisions and Failures

- Reject every tested adaptive policy under the frozen retention rule. L reduces default
  mean outside loss from 4.19% to 1.92%, but worsens 0.12 sensitivity; LS loses an in-band
  A501 result, and neither shape cue earns its mechanism. These are uncertain calibration
  totals, without annotated local biological truth. Retain the existing 0.10 default;
  adaptive port, recipe, Wasm transport, and interface milestones are N/A. The broader
  automatic-counting plan remains open.

## 2026-11-11

### Added

- Added click-and-drag image panning with grab/grabbing cursors, pointer capture, and
  keyboard guidance across Raw, DoG, and Threshold views.

- Added Raw, DoG, and Threshold viewer tabs using the selected image's actual detector
  settings, with shared zoom and detection overlays.

- Benchmarked fixed and image-adaptive DoG cutoffs on the real calibration images and
  verified whether merging threshold runs changes the selected cell centers.

- Added a saloon entrance with swinging-door hover and keyboard access, original editable
  SVG saloon, horses, longhorn skull, and saguaro artwork.
- Added current saloon and populated-counter WebP screenshots to the README.

- Added mean, median, and population standard deviation of successful comparison counts to the detailed feedback.

- Added B301 and H1001 calibration references and measured unchanged-default Rust/Wasm counts against all eight images.

- Inspected touching fluorescent objects with actual Rust/Wasm detections and compared size/k sensitivity on three real-image crops.

- Built a browser-local PI-positive cell counter with a TypeScript interface and Rust/Wasm detector.
- Added image overlays, sequential plate-sized batches, cancellation, and CSV results.
- Added real-image size measurements and calibration against six human reference counts.
- Added 27-setting DoG comparisons and stability-based auto-tuning before batch analysis.
- Added GitHub Pages packaging and native/Wasm parity and browser workflow checks.

### Changed

- Prepared comparison images once in Rust/Wasm and reused the latest DoG response for
  threshold-only trials, removing repeated full-image copies between comparison runs.
  Kept per-run progress, results, cancellation, and detection behavior intact. Retained
  only one red signal and one response (8 bytes per pixel) until replacement/completion.
  The real A501/H501 benchmark used 29.4% less comparison time and 95.2% fewer transferred
  image bytes, with identical counts. Added boundary parity checks and a reproducible harness.

- Separated Single image tuning/inspection and Batch processing/export into explicit
  modes, preserving files, counts, and settings across handoffs and mode changes.

- Shortened the workbench header with smaller title/skull sizing, tighter spacing,
  and two text levels so the image and controls appear higher on the page.

- Grouped the workbench into image selection, tuning, and batch/export stages; reduced
  the masthead, added a prominent selected-image count and settings context, and made
  comparison statistics and the return to pick inspection easier to find.
- Disabled analysis before image selection, added counted/waiting/failed batch totals,
  and made ledger image selection work through native keyboard-accessible buttons.

- Made Compare settings the primary starting action, added 15-100 run selection with
  a 21-run default, and put mean, median, and population SD in the comparison table.
- Rounded actual detector settings and CSV values with the displayed settings, grouped
  counts with commas, and required response thresholds strictly greater than 0.00001.

- Extended the Western theme with wood panels, a wanted poster, an aged-paper count ledger,
  and an illustrated empty image view.

- Replaced the 27-setting grid with a 15-point log-space central composite design and representative median-run application.
- Allowed continuous DoE parameter values and positive thresholds below 0.001.

- Expanded image zoom for close pick inspection and added actual-pixel and fit-image views.

- Improved comparison feedback with progress, timing, result spread, recommendation context, and explicit applied-setting status.

- Refreshed the README with the Pages link, calibration evidence, and auto-tuning workflow.
- Updated the Pages workflow seed to Node 26 and current stable Rust for browser Wasm builds.

- Restyled the interface with a dark frontier palette, Western masthead, red sun, and weathered cream accents inspired by Red Dead Redemption.

- Calibrated the shared detector default to a 10-pixel diameter, k of 4, and response threshold of 0.10.
- Updated npm and Cargo dependencies, including the TypeScript 7 compiler and lint compatibility API.

### Fixed

- Corrected the browser title, workbench heading, and README heading to the full
  program name, Red Dead Cell Counter.

- Fixed intermediate tablet control overflow and kept ledger image buttons legible
  when hovered or focused; enlarged inspection and analysis controls for touch use.

- Fixed loaded-image panel overflow on narrow screens and improved the highlighted
  comparison label's contrast; refreshed the README comparison and interface screenshots.

- Overrode the vulnerable transitive minimatch dependency with its patched release; npm audit reports zero findings.

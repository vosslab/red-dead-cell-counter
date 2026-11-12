# Changelog

## 2026-11-12

### Fixes and Maintenance

- Reduced `src/main.ts` from 958 lines to a 36-line startup and event-wiring module.
  Separated workflow coordination, worker requests and image decoding, image results
  and CSV export, comparison presentation, settings validation, and count statistics.
  Preserved existing detector settings, prepared-image reuse, and user workflows.

### Developer Tests and Notes

- Passed the Pages build, type/lint/format checks, six design tests, all 19 Chromium
  workflows, and 314 focused repository checks. The source-line warning is resolved;
  independent review found no behavior blockers. No new dependencies were added.

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

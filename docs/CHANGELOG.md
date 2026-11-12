# Changelog

## 2026-11-11

### Added

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

- Overrode the vulnerable transitive minimatch dependency with its patched release; npm audit reports zero findings.

# Changelog

## 2026-11-11

### Added

- Built a browser-local PI-positive cell counter with a TypeScript interface and Rust/Wasm detector.
- Added image overlays, sequential plate-sized batches, cancellation, and CSV results.
- Added real-image size measurements and calibration against six human reference counts.
- Added 27-setting DoG comparisons and stability-based auto-tuning before batch analysis.
- Added GitHub Pages packaging and native/Wasm parity and browser workflow checks.

### Changed

- Refreshed the README with the Pages link, calibration evidence, and auto-tuning workflow.
- Updated the Pages workflow seed to Node 26 and current stable Rust for browser Wasm builds.

- Restyled the interface with a dark frontier palette, Western masthead, red sun, and weathered cream accents inspired by Red Dead Redemption.

- Calibrated the shared detector default to a 10-pixel diameter, k of 4, and response threshold of 0.10.
- Updated npm and Cargo dependencies, including the TypeScript 7 compiler and lint compatibility API.

### Fixed

- Overrode the vulnerable transitive minimatch dependency with its patched release; npm audit reports zero findings.

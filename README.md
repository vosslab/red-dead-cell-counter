# red-dead-cell-counter

Count propidium-iodide-positive cells in fluorescence JPEG and PNG images directly in a
browser. The image data stays on the device: Rust/WebAssembly detects red fluorescent
objects and the TypeScript interface draws the resulting centers over the source image.

Select one image and compare the 27 nearby detector settings. The comparison spans cell
diameters of 75%, 100%, and 125% of the current value; k = 3, 4, and 6; and response
thresholds of 50%, 100%, and 200% of the current value. Each result shows its count and
elapsed analysis time. **Auto-tune** chooses the most stable result across those nearby
settings, then applies it to the current image or an entire batch. Batch results download as
CSV with the source filename, image dimensions, detector settings, count, and any per-file
error.

## Detector

The detector extracts red signal as `max(0, R - max(G, B)) / 255`, then uses a
Difference of Gaussians (DoG) tuned to an approximate cell diameter. The two Gaussian
scales are calculated from equation 4 of Voss et al., *DoG Picker and TiltPicker*:

```text
sigma1 = radius * sqrt((k^2 - 1) / (2 * k^2 * ln(k)))
sigma2 = k * sigma1
```

The detector starts at a 10-pixel diameter, k = 4, and a 0.10 response threshold. Against
the six supplied calibration images, it produced counts of 398, 339, 296, 546, 1172, and
3021, for a 11.6% mean absolute percentage error; the earlier 14-pixel, 0.04 setting was
31%. Those six reference counts are calibration data, not independent validation. Auto-tune
measures local stability rather than biological accuracy. See [the experiment
record](docs/DETECTOR_EXPERIMENT.md) for the real-image comparison and limits.

## Build and run

Install the dependencies and build:

```sh
npm ci
rustup target add wasm32-unknown-unknown
cargo install wasm-pack --locked
./build_github_pages.sh
./run_web_server.sh
```

On a managed machine where wasm-pack cannot use its default cache, set its standard cache
location for the build command, for example:

```sh
WASM_PACK_CACHE=/private/tmp/wasm-pack-cache ./build_github_pages.sh
```

Open the local URL printed by the server. Run checks with:

```sh
./check_codebase.sh
cargo test --manifest-path rust/Cargo.toml
./run_playwright_tests.sh
```

`tools/characterize_images.py` is the calibration experiment; use the repository Python
environment when running it:

```sh
source source_me.sh && python3 tools/characterize_images.py
```

## Deployment

`build_github_pages.sh` produces a static `dist/` site suitable for GitHub Pages. The
root [deployment workflow seed](deploy-pages.yml) includes the Rust/Wasm build setup; it
is not active until it is moved to `.github/workflows/deploy-pages.yml`.

## License

Source code: [LICENSE.MIT](LICENSE.MIT).

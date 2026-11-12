# Wasm comparison performance

## Measured result

On 2026-11-11, full-resolution A501 and H501 each ran the default 21-setting
comparison twice before and twice after the optimization. The pooled median elapsed
time fell from 13.674 s to 9.654 s: 29.4% less time, or about 1.42 times as fast.
Every tested diameter, k, threshold, count, and design-point kind matched the baseline.

Per-image medians of the two repetitions:

| Image | Before | After | Time reduction |
| --- | ---: | ---: | ---: |
| A501 | 13.544 s | 9.629 s | 28.9% |
| H501 | 13.757 s | 9.913 s | 27.9% |

Each comparison previously sent 21 complete RGBA buffers to its worker. Now it sends
one: approximately 1.52 GB becomes 72.3 MB, a 95.2% reduction in transferred image bytes.
Subsequent requests contain dimensions and detector settings. The browser no longer
makes a fresh full-image copy for every trial.

These measurements used macOS arm64 on an Apple M4 Max, Node 26.13.0, and headless
Chromium 158.0.8127.18 with the release Pages build. The timing includes initial image
preparation and worker startup. This is a small local benchmark, not a hardware-independent
speed guarantee. One optimized H501 repetition overlapped short compiler checks.
Baseline completion was sampled at progress 21; the updated harness additionally waits
for the Compare button to re-enable, so it includes final result bookkeeping.

The optimized comparison's requestAnimationFrame intervals had median 16.7 ms and worst
16.8 ms; no main-thread long tasks were observed. The baseline also had a 16.7 ms median
and no observed long tasks. Thus the demonstrated gain is comparison latency and image
traffic, rather than evidence that the original interface dropped frames. A useful
responsiveness target is one frame per 16.7 ms at 60 Hz; it is not a timing test gate.

## Boundary and ownership

The existing `cell_detector` crate remains a `cdylib`/`rlib`, targeting the browser's
`wasm32-unknown-unknown` runtime through `wasm-bindgen`. Native checks use
`aarch64-apple-darwin`. The package command is:

```bash
WASM_PACK_CACHE=/Users/vosslab/.cache/wasm-pack ./build_github_pages.sh
```

Generated bindings live in `rust/pkg/`; the delivered browser loads `dist/worker.js`
and `dist/wasm/cell_detector_bg.wasm`. Existing standalone `detect` and `preview`
exports retain their inputs, results, and validation.

The new `PreparedImage` constructor borrows RGBA bytes for the call, validates
dimensions and buffer length, and creates an owned float red signal. JavaScript can
then release its transferred RGBA buffer. Its `detect(diameter, k, threshold)` method
returns owned center-coordinate arrays and keeps only the latest DoG response.
Threshold-only trials reuse that response; diameter/k changes release it before the
next blur allocates its buffers. Each request still produces an individual result and
can be cancelled by terminating the worker. No ordering or detector formula changes.

The retained red signal and response use 8 bytes per pixel together: about 138 MiB
for A501, up to 305 MiB at the existing 40-megapixel limit. Temporary blur buffers
require additional memory. A new image explicitly frees the previous prepared object;
an invalid replacement clears it. Reserved Wasm memory can remain allocated until
the worker terminates, which occurs at completion or cancellation. There is no
multi-image or multi-scale cache. Preview-plane storage remains unchanged.

Native `PreparedImage::from_rgba` and `detect_core` return `Result<_, String>`;
the small Wasm adapter converts errors to JavaScript exceptions. The worker returns
the existing `{id, error}` response. Omitting pixels requires an already prepared image
of the requested dimensions. Invalid image replacement cannot silently reuse old data.
No unsafe code, new dependency, browser API, or browser-support requirement was added.
The ownership design follows the official
[wasm-bindgen exported-struct contract](https://wasm-bindgen.github.io/wasm-bindgen/contributing/design/exporting-rust-struct.html).

## Package cost and verification

| Asset | Before bytes | After bytes | Before gzip | After gzip |
| --- | ---: | ---: | ---: | ---: |
| Wasm | 44,922 | 45,911 | 20,141 | 20,666 |
| Worker JavaScript | 3,486 | 4,371 | 1,477 | 1,864 |

Type checking, lint, formatting, six design checks, seven native Rust tests, and
all-target Clippy with warnings denied passed. Focused repository checks passed 287
cases, with the existing advisory for `src/main.ts` approaching its line limit.
The release browser suite passed 19
workflows, including all eight real calibration images, comparison/application,
100-run experiments, batch CSV, cancellation, preview parity, and prepared-image
replacement/error recovery. Native and browser fixtures agree on exact centers and
the existing DoG/Threshold checksums. The detector's biological calibration is unchanged.

The remaining TypeScript work is primarily DOM, browser image decoding, Canvas drawing,
and statistics on at most 100 counts. A blanket Rust port would add browser bindings
and copying without an established benefit. The grayscale-preview expansion still
uses TypeScript; sending RGBA previews instead would quadruple cached plane bytes.

The 96-image stress test, other browsers, live Pages deployment, heap profiling, and
CPU tracing were not repeated for this change.

## Reproduce the measurement

Serve the repository root in one terminal:

```bash
source source_me.sh && python3 -m http.server 4184 --bind 127.0.0.1 --directory .
```

With the before-change release build in `dist/`, capture the baseline. Then rebuild
the optimized source and run the second command:

```bash
PLAYWRIGHT_BROWSERS_PATH=/Users/vosslab/.cache/ms-playwright node tests/playwright/benchmark_comparison.mjs baseline
PLAYWRIGHT_BROWSERS_PATH=/Users/vosslab/.cache/ms-playwright node tests/playwright/benchmark_comparison.mjs optimized
```

The harness saves ignored `generated/comparison_benchmark_baseline.json` and
`generated/comparison_benchmark_optimized.json`, with timings, row outcomes, transferred
bytes, frame intervals, and asset sizes. The optimized run asserts exact settings/count
agreement against the saved baseline. Keep that baseline when rebuilding; do not label
an optimized build as the historical baseline.

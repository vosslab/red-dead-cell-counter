# Blob measurements

## Purpose

This contract adds reusable geometry measurements for binary foreground blobs. It is a
browser-local worker primitive, not a new cell-counting method, automatic selection rule,
or user-interface control. The existing detector and its counts do not change.

The measurements make it possible to inspect thresholded objects, including touching
objects, before deciding whether an area or shape cue earns use in a future detector.
The related [BLOB_AREA_EXPERIMENT.md](BLOB_AREA_EXPERIMENT.md) records the real-image
research experiment; it does not establish a biological classification rule.

## Runtime contract

| Layer | Contract |
| --- | --- |
| Rust core | `measure_blobs_core(mask, width, height) -> Result<Vec<f64>, String>` |
| Wasm export | `measure_blobs(mask, width, height) -> Float64Array` or a thrown Rust error |
| Worker request | `{ id, kind: "blobs", mask: ArrayBuffer, width, height }` |
| Worker success | `{ id, blobFeatures: Float64Array }`, with the feature buffer transferred |
| Worker failure | `{ id, error }` |

The canonical implementation is `rust/src/blob_features.rs`. It compiles for
`wasm32-unknown-unknown` with wasm-bindgen and wasm-pack. The GitHub Pages build remains:

```sh
WASM_PACK_CACHE=/Users/vosslab/.cache/wasm-pack ./build_github_pages.sh
```

The browser needs neither Python nor a processing server; GitHub Pages serves the static
assets. Python remains a research oracle only. Esbuild retains the `measure_blobs` import used by `src/worker.ts`
when it bundles the generated Wasm glue.

## Mask and safety rules

- Mask byte zero means background; every nonzero byte means foreground.
- The Rust core uses a nonzero predicate in an iterative flood fill, so neighboring bytes
  with values 1 and 255 belong to the same foreground component.
- Width and height must describe exactly `mask.len()` bytes and a pixel count from 1 through
  40,000,000. Invalid input becomes a Rust `Result` error and then a worker error response.
- Labeling uses eight-connectivity. Components are ordered by their first foreground pixel in
  row-major order.
- The call holds a temporary visited byte per pixel, a stack for the current component,
  component statistics, and output records. It retains no image or feature cache after return.
  The stack is reused across components within a call. Output requires 64 bytes per blob;
  highly fragmented masks can therefore produce large results even within the input-size cap.

## Flat feature layout

`blobFeatures` stores one eight-value `f64` record per component. For component `i`, its
record begins at `8 * i`.

| Offset | Field | Meaning |
| --- | --- | --- |
| 0 | `first_x` | X coordinate of the component's row-major anchor pixel |
| 1 | `first_y` | Y coordinate of the component's row-major anchor pixel |
| 2 | `area_px` | Foreground pixel count |
| 3 | `centroid_x` | Unweighted binary-pixel centroid X coordinate |
| 4 | `centroid_y` | Unweighted binary-pixel centroid Y coordinate |
| 5 | `equivalent_diameter_px` | Diameter of a circle with the same pixel area |
| 6 | `roundness` | Area/perimeter compactness `4 * pi * A / P^2` |
| 7 | `inertia_ratio` | Major/minor binary covariance eigenvalue ratio |

`first_x` and `first_y` identify a component reproducibly; they are not a detected cell
center. The centroid uses equal weights for all foreground pixels, not fluorescence intensity.
Equivalent diameter is `2 * sqrt(A / pi)`.

## Shape definitions

Roundness uses the exposed orthogonal sides of every foreground pixel as perimeter. When a
pixel's side contribution is exactly two, it is replaced by `sqrt(2)`, matching the historical
[Appion imagefun implementation](https://github.com/leginon-org/leginon/blob/myami-python3/pyami/imagefun.py).
Raster roundness can exceed 1, so it is deliberately not clamped.

Inertia ratio comes from the eigenvalues of the equal-weight binary-pixel covariance about the
centroid: `lambda_max / lambda_min`. A round, isotropic distribution approaches 1; an elongated
distribution has a larger ratio. A component with a nonpositive minor eigenvalue reports `NaN`.
The calculation uses a numerically stable centered accumulation rather than intensity values.

Roundness and inertia ratio measure different properties. Roundness is an area/perimeter measure:
a jagged or fragmented boundary reduces it. Inertia ratio describes how the component's pixels are
distributed about their centroid: a rough but symmetric blob can have low roundness and a ratio
near 1. Roundness is a 2D compactness analogue of the 3D sphericity concept; it is not an
unnormalized form of inertia.

The old Appion `_moment` intensity-weighted calculation is intentionally not ported. Its value
depends on brightness as well as shape, while this contract measures binary threshold masks.

## Verification boundary

The Python oracle is `devel/measure_blob_areas.py`; it produces exact native DoG masks from the
real calibration images. `devel/verify_blob_features.py` compares those masks with the native
Rust probe, and `tests/playwright/verify_blob_features.mjs` checks the browser worker result.

Run the native parity check after the Rust probe is built:

```sh
source source_me.sh && python3 devel/verify_blob_features.py
```

Run the worker parity check against a production Pages build served on port 4188:

Serve the repository root with `source source_me.sh && python3 -m http.server 4188 --bind 127.0.0.1`;
the harness opens `/dist/` and fetches its temporary masks from ignored `generated/`.

```sh
PLAYWRIGHT_BROWSERS_PATH=/Users/vosslab/.cache/ms-playwright \
  node tests/playwright/verify_blob_features.mjs http://127.0.0.1:4188/
```

Actual verification results belong in [VERIFICATION.md](VERIFICATION.md). These checks establish
implementation parity only; they do not validate blob shape as a cell identity criterion.

# Usage

Refine parameters and count PI-positive red fluorescent objects in JPEG/PNG microscopy
images. Images are decoded and processed on your device; the static site does not
upload them. Follow [WALKTHROUGH.md](WALKTHROUGH.md) for the illustrated workflow.

## Refine and count

1. Open [Red Dead Cell Counter](https://vosslab.github.io/red-dead-cell-counter/).
2. Select **Choose images** and open one or several files. Review diameter/k starting
   estimates and the number of refinement trials, then select **Refine and count**.
   **Try an example** loads and refines the real A501 field immediately.
3. Read the visible trial statistics and inspect the markers. Adjust starting estimates
   and select **Refine selected image** as needed, then select **Download CSV**.

Refinement is part of the normal processing workflow. Every chosen image runs
independently: fresh pixels produce a binary Otsu starting threshold with the entered
diameter/k, a trial design explores diameter/k/threshold, and an actual tested run
closest to the median count is applied. A no-signal image returns zero without a sweep.
The manual threshold input does not affect automatic refinement.

The combined pipeline has no independent biological validation. The eight-image
calibration in [AUTOMATIC_DETECTOR_EXPERIMENT.md](AUTOMATIC_DETECTOR_EXPERIMENT.md)
applies only to the older Otsu starting-threshold method. Agreement across trials
measures sensitivity to settings, not biological accuracy.

## Set processing parameters

Controls are visible above the workspace. Diameter and k are starting estimates;
the tool does not guarantee automatic cell-size measurement.

| Control or action | Effect |
| --- | --- |
| Cell diameter | Expected spot width in original pixels; initial 10 px, range 2-200. |
| DoG k | Relative background blur scale; initial 4, range 1.1-8. |
| Response threshold | Raw DoG cutoff for Count once only; initial 0.10000, not a percentage. |
| Refinement trials | 15-100 trials per image, default 21. |
| Refine and count | Refines every chosen image independently and saves automatic results. |
| Refine selected image | Runs the same automatic refinement on the selected image only. |
| Count once with these settings | Applies entered diameter/k/threshold to the selected image as manual analysis. |
| Apply on a trial row | Reruns that tested setting on the selected image and saves manual analysis. |

Diameter/k are rounded to two decimals and manual threshold to five; threshold must
exceed 0.00001 (minimum rounded value 0.00002). Input edits leave existing counts and
saved actual settings unchanged until a successful replacement result is saved.

Refinement progress and mean, median, population SD, minimum, and maximum are visible
by default. Expand **Inspect all trial settings and counts** for full trial rows or
**Design details and parameter ranges** for the trial design. The selected tested run
is representative of these trials; it is not an optimizer or an accuracy guarantee.
See [EXPERIMENT_DESIGN.md](EXPERIMENT_DESIGN.md).

## Inspect each image

- Select a ledger filename to restore its saved count, actual settings, and refinement feedback.
- **Raw** shows original RGB pixels; **DoG** shows contrast-stretched cell-scale response.
  **Threshold** shows pixels meeting the saved cutoff; white regions are not counts.
- Toggle **Show detections** to compare green center markers with the underlying image.
- Use **Actual pixels** or **Zoom**, drag to pan, and use **Fit image** to return.
  Arrow keys, scrollbars, and touch scrolling also navigate the image.
- Inspect faint objects, touching cells, debris, and the review notice. Automatic
  refinement remains provisional. A full trial count span greater than 10% of the
  selected count adds a sensitivity notice; it is not a biological confidence interval.

Selecting a row does not rerun its image or choose a recipe for other files.

## Read object insights

The selected image's ledger shows mean, median, population SD, and n for threshold-object
area (px^2), equivalent diameter (px), roundness, inertia ratio, and mean squared radius
(px^2). These statistics use single-center objects away from image edges as an
approximation to individual cells. They are not validated segmented-cell measurements.
Each metric uses its finite observations; `--` means no usable observations.

The object counts also include multiple-center, no-center, and edge objects; the edge
category overlaps the center categories. Cluster area stays whole rather than being
divided by its number of centers. Shape measurements describe the saved threshold mask;
they do not change which detections count.

Below the workspace, challenge cards show real raw-image crops with gold object bounds
and green accepted centers. They highlight multiple-center objects and unusual
single-center shapes when available. **Inspect this region** navigates the main viewer.
The detector retains DoG maxima that pass its spacing rule; the cards do not imply
that touching-cell boundaries have been split.

**Download object measurements CSV** saves `object-measurements.csv` for every threshold
object in the selected image, with geometry, saved settings, edge flags, center counts,
and one-based center indices. See [BLOB_MEASUREMENTS.md](BLOB_MEASUREMENTS.md) for definitions.

## Preserve partial work

Images run sequentially. Select **Cancel refinement** to stop; completed and previously
saved analyses remain available. A failed or cancelled rerun can retain an earlier
count. The ledger and summary identify the attempt status and previous analysis; CSV
keeps the saved count's actual settings beside that status/error. Rows that have never
completed have no count.

Download before choosing a new file set or leaving the page. New selections replace
the ledger. Counts, center arrays, object measurements, and individual trial rows stay in page memory for
the current selection; CSV is not a reloadable analysis session.

## Inputs and outputs

Inputs are JPEG/PNG files; the real example is [A501.jpg](../IMAGES/A501.jpg).
**Download CSV** saves `dead-cell-counts.csv`, including one-image and partial results.
Existing columns retain their order; refinement and morphology summaries are appended:

- Filename, width/height, count, attempt status, and error.
- Actual diameter, k, and cutoff used for the saved analysis.
- Algorithm version, method, automatic/manual mode, review reasons, and no-signal flag.
- Requested, successful, and failed trial counts; seed method and threshold.
- Trial count mean, median, population SD, minimum, and maximum.
- All-object and center-category counts, edge count, morphology sample n, mean/median
  object area, mean roundness, mean inertia ratio, and mean squared radius.

Automatic refinement records method `dog_ccd_median`, version `dog-refinement-1`, and
review reason `provisional_refinement`. Sensitive results also record
`refinement_sensitive`. CSV contains summary provenance, not all trial rows or centers.

## Build and check locally

For a guided browser session, use [WALKTHROUGH.md](WALKTHROUGH.md). Local development
requires Node.js 26 with npm, current stable Rust with Cargo/rustup, and wasm-pack;
`run_web_server.sh` also uses Python 3 to serve the built site.

```sh
npm ci
rustup target add wasm32-unknown-unknown
cargo install wasm-pack --locked
./run_web_server.sh
```

Open the printed local URL and select **Try an example**. The server builds and serves
`dist/`, the GitHub Pages artifact. For a build alone, run `./build_github_pages.sh`.
If a managed machine blocks the default wasm-pack cache, use
`WASM_PACK_CACHE=/private/tmp/wasm-pack-cache ./build_github_pages.sh`.

The usual engineering checks are:

```sh
./check_codebase.sh
cargo test --manifest-path rust/Cargo.toml
./run_playwright_tests.sh
```

For optional Python characterization, install NumPy, SciPy, and Pillow, then run:

```sh
source source_me.sh && python3 tools/characterize_images.py
```

These checks do not establish biological accuracy. [VERIFICATION.md](VERIFICATION.md)
records what has actually been checked. See [CODE_ARCHITECTURE.md](CODE_ARCHITECTURE.md)
and [FILE_STRUCTURE.md](FILE_STRUCTURE.md) for the shared native/Wasm detector path.

The TypeScript 7 compiler uses the TypeScript 6 compatibility API for ESLint.
Lockfiles record installed npm and Cargo releases. The root
[deploy-pages.yml](../deploy-pages.yml) remains the editable seed for
[.github/workflows/deploy-pages.yml](../.github/workflows/deploy-pages.yml).

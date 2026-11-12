# Red Dead Cell Counter

Count red-stained cells, inspect every pick, and explore how image analysis works. Built for biology students and researchers, this browser-based tool turns propidium-iodide fluorescence images into marked counts and downloadable data.

**[Enter the saloon and try it](https://vosslab.github.io/red-dead-cell-counter/)**

No installation or account needed. Your images stay on your device. Bring a JPEG or PNG
from the microscope, or start with one of the real images included here.

## See the cells, check the count

The green circles show what the detector counted. Zoom in, drag around the image, and
decide whether the picks match the cells you see. The Western saloon, wood panels, and
wanted-poster styling give the lab work a little frontier character.

<!-- screenshots:begin (managed by screenshot-docs) -->
![H501 propidium-iodide image with 3,021 counted cells and visible detection rings](docs/screenshots/counter.webp)
<!-- screenshots:end -->

This example uses the real H501 field: **3,021 detections**, compared with a human
reference of **2,997**. See the [visual tour](docs/SCREENSHOTS.md) for the saloon,
comparison feedback, image-processing views, and batch workflow.

This is a research and teaching tool. Its counts need inspection: dim cells, bright
debris, and touching cells can change the result. The eight reference images are
calibration data, not independent validation.

## Try your first cell count

1. Save the example [H501.jpg](IMAGES/H501.jpg) to your computer, or use your own
   red-fluorescence JPEG or PNG. On GitHub, open the image and use **Download raw file**
   or your browser's **Save image as** command.
2. [Open the tool](https://vosslab.github.io/red-dead-cell-counter/), select
   **Enter saloon**, and stay in **Single image**. Select **Choose image** and open the file.
3. Select **Compare settings**. Leave **Comparison runs** at 21 for your first try.
   The tool tests nearby cell sizes and detection cutoffs, shows the counts, and applies
   an actual tested run closest to the median count. You can choose **Apply** on another row.
4. Select **Inspect applied detections**. Use **Actual pixels** or the zoom slider,
   then click and drag to inspect the circles. Switch between **Raw**, **DoG**, and
   **Threshold** to see how the image becomes a set of picks.

With the current starting settings and 21 runs, H501 produces an applied count of
3,021. You can use the tool without knowing Rust, TypeScript, or the filter equations.
The mean, median, and standard deviation summarize how much counts vary with settings;
they do not tell you which count is biologically correct.

## Take it to your lab

- **Check the evidence behind a number.** Inspect every marked location instead of
  relying on a count alone. Arrow keys, scrollbars, and native touch scrolling also pan.
- **Explore image analysis visually.** Follow the same field from raw fluorescence
  through a Difference of Gaussians (DoG) filter to a threshold mask.
- **Compare before committing.** Test 15-100 settings, review the count spread, and
  apply a run with its actual settings and overlay.
- **Count a whole image set.** Switch to Batch, process images sequentially, and export
  counts, filenames, applied settings, and any errors as a spreadsheet-ready CSV.

For a batch, select **Use settings for batch**, then **Choose images** and
**Analyze images**. Select **Download CSV** when processing finishes. Alternatively,
**Compare, then analyze batch** performs the comparison and batch analysis together.
Mode changes preserve your selected files and finished counts. Select a ledger row
and **Tune selected image** to inspect or retune it.

### A small biology challenge

Find an isolated red spot and a pair of touching spots. Inspect both with detections
on, then switch through the three image views. Apply a different comparison row and
look for one pick that appears, disappears, or moves. Explain the difference using
what you can see in the original image. A larger count is a result to investigate.

## What is being counted?

Propidium iodide (PI) is commonly used to identify cells with compromised membranes:
it is excluded by intact membranes and fluoresces strongly after binding nucleic acids.
See [Thermo Fisher's PI overview](https://www.thermofisher.com/us/en/home/life-science/cell-analysis/fluorophores/propidium-iodide.html).

The program counts red fluorescent objects under your chosen settings. A red-channel
image alone does not supply a total-cell count or a percentage of viable cells.
Check the stain, acquisition conditions, and picks before interpreting a biological result.

You only need three detector controls:

| Control | What it means |
| --- | --- |
| Cell diameter | The approximate width of a cell's fluorescent spot, in image pixels. |
| DoG k | How much broader the background blur is than the spot blur. |
| Response threshold | How strong a filtered peak must be to count. Lower values can admit faint cells and noise. |

The starting values are diameter **10 px**, **k = 4**, and threshold **0.10000**.
The threshold is a filter response, not a percentage. Values below 0.001 are supported;
the smallest five-decimal setting is 0.00002. The Raw view shows the original RGB image,
DoG stretches contrast for display, and Threshold shows the mask from the actual cutoff.
Display stretching does not change the count.

For the design, parameter ranges, and rounding rules, see
[docs/EXPERIMENT_DESIGN.md](docs/EXPERIMENT_DESIGN.md).

## How close are the counts?

The shared starting settings give the following results on eight real images:

| Image | Human reference | Detector count |
| --- | ---: | ---: |
| A101 | 332 | 398 |
| A501 | 362 | 339 |
| B301 | 235 | 294 |
| C601 | 270 | 296 |
| E401 | 450 | 546 |
| F201 | 1,050 | 1,172 |
| H1001 | 745 | 785 |
| H501 | 2,997 | 3,021 |

The mean absolute percentage error is **12.5% on these calibration images**.
Earlier tuning on the original six images reduced that calibration error from
31.0% to 11.6%; adding B301 and H1001 gives the eight-image result above.
Agreement or stability on these images does not establish accuracy on a new experiment.
Start with an inspected image before reusing settings across a plate, especially when
exposure, staining, magnification, or cell density differs.

## Follow your curiosity

- [Visual tour](docs/SCREENSHOTS.md): see each part of the interface with real cells.
- [Single-image and batch workflows](docs/WORKFLOW_MODES.md): choose the right mode and move between them.
- [Comparison design](docs/EXPERIMENT_DESIGN.md): understand the tested settings and median-run choice.
- [Real-image experiments](docs/DOE_RESULTS.md): see what happens at different sizes and cutoffs.
- [Threshold experiments](docs/THRESHOLD_EXPERIMENT.md): compare fixed and automatic cutoff methods.
- [Detector method and calibration](docs/DETECTOR_EXPERIMENT.md): follow the DoG equations and original experiments.
- [Verification](docs/VERIFICATION.md): read what was tested and what remains uncertain.

## For coders and curious students

<details>
<summary>Build locally, inspect the method, and run the checks</summary>

You need Node.js 26 with npm, current stable Rust with Cargo/rustup, and wasm-pack.
The browser version above needs none of this setup.

```sh
npm ci
rustup target add wasm32-unknown-unknown
cargo install wasm-pack --locked
./run_web_server.sh
```

The server builds the GitHub Pages artifact and prints a local URL. Open it, select
**Enter saloon**, choose an image in **Single image**, and select **Compare settings**
or **Analyze selected image**. The count and detection circles appear above/on the image.
**Fit image** restores the overview; zoom reaches 6400% of the fitted view.

For a production build without starting the server, run `./build_github_pages.sh`.
If a managed machine blocks the default wasm-pack cache, use
`WASM_PACK_CACHE=/private/tmp/wasm-pack-cache ./build_github_pages.sh`.

The browser decodes JPEG/PNG images and transfers RGBA pixels to a worker. Rust extracts
`max(0, R - max(G, B)) / 255`, applies float DoG filtering with `image`/`imageproc`,
and returns cell-center coordinates through `wasm-bindgen`. Gaussian scales follow
equation 4 of Voss et al., *DoG Picker and TiltPicker*; the equations are in
[docs/DETECTOR_EXPERIMENT.md](docs/DETECTOR_EXPERIMENT.md).

```sh
./check_codebase.sh
cargo test --manifest-path rust/Cargo.toml
./run_playwright_tests.sh
```

For optional Python characterization, install NumPy, SciPy, and Pillow, then run:

```sh
source source_me.sh && python3 tools/characterize_images.py
```

The TypeScript 7 compiler uses the TypeScript 6 compatibility API for ESLint.
Lockfiles record the installed npm and Cargo releases. See
[docs/DESIGN_DECISIONS.md](docs/DESIGN_DECISIONS.md),
[docs/WASM_PERFORMANCE.md](docs/WASM_PERFORMANCE.md), and
[docs/REFERENCE_COUNTS.csv](docs/REFERENCE_COUNTS.csv) for architecture, measurements,
and reference data; [docs/CHANGELOG.md](docs/CHANGELOG.md) records changes.

`build_github_pages.sh` emits `dist/`, including the worker and Wasm binary.
The root [workflow seed](deploy-pages.yml) remains the editable template for
[the deployed Actions workflow](.github/workflows/deploy-pages.yml).

</details>

## Credits and license

Jaren supplied the fluorescence images. The interface uses original frontier SVG art,
CSS wood and poster styling, and system fonts.

License text: [LICENSE.MIT](LICENSE.MIT) (MIT). Its copyright attribution is still unfilled.

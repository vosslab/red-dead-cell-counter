# Red Dead Cell Counter

Count red-stained cells in your browser, inspect the detection markers, and download a spreadsheet. Built for biology students and researchers, with automatic image-by-image thresholds and a Wild West saloon.

**[Choose your images or try a real example](https://vosslab.github.io/red-dead-cell-counter/)**

No installation or account needed. Your images stay on your device. Start with one
JPEG or PNG, or bring a whole set from the microscope.

**Automatic counts are provisional.** The method was selected using eight calibration
images with uncertain human ImageJ totals. It still needs independent biological
validation, so inspect the markers before using a count.

## See the cells

Green circles mark the centers the detector counted. Zoom in and drag around your
image to check faint spots, touching cells, and bright debris. The saloon, wanted
poster, and wooden bounty board give the lab work a little frontier character.

<!-- screenshots:begin (managed by screenshot-docs) -->
![A501 automatic count with actual cutoff, provisional notice, and green detection markers](docs/screenshots/counter.webp)
<!-- screenshots:end -->

The example comes from a real microscope image. The count, processing method, and
actual cutoff appear beside the image so you can check what produced the markers.
See [docs/SCREENSHOTS.md](docs/SCREENSHOTS.md) for the visual tour.

## Try your first count

1. [Open the tool](https://vosslab.github.io/red-dead-cell-counter/) and select
   **Try an example**. It loads and automatically counts the real A501 image using
   the same processing as your own files.
2. Inspect the green markers. Use **Actual pixels**, the **Zoom** slider, and
   click-and-drag panning to look closely. **Fit image** restores the overview.
3. Switch between **Raw**, **DoG**, and **Threshold** to see the original image,
   cell-sized contrast, and pixels that pass this image's cutoff.
4. Select **Download CSV** to save the count and the settings that produced it.

For your own images, select **Choose images**, open one or several JPEG/PNG files,
then select **Count cells**. The tool adjusts the threshold separately for every
image. Selecting a filename on the bounty board opens its saved count and markers.
You do not need to choose a mode or tune the detector first.

### A small biology challenge

Find one isolated red spot and a pair of touching spots. Switch off **Show detections**
and predict where the centers should be. Switch it on again and compare. The white
regions in **Threshold** are candidate pixels; a joined region can contain several
counted centers. Explain one agreement or disagreement using the **Raw** image.

## Bring a whole image set

- **Count one field or a plate.** Choose one or many images; each receives its own cutoff.
- **Inspect the evidence.** Every saved count has its original-pixel markers and actual settings.
- **Keep partial work.** Cancel counting preserves completed and previously saved results.
  CSV includes failed and cancelled rows so missing results remain visible.
- **Explore the method.** Open **Advanced settings** for manual analysis and 15-100
  comparison runs on the selected image. The mean, median, and standard deviation
  describe sensitivity to settings; they do not measure accuracy or select a batch recipe.

Changing Advanced diameter or k affects the next automatic run; changing controls
keeps existing counts attached to their saved settings. Manual analysis and comparison
affect the selected image only. Choosing a new file set replaces the current ledger;
download your results before starting another set.

## What does a count mean?

The tool finds red fluorescent objects in propidium-iodide (PI) microscopy images.
Check the stain, acquisition conditions, and markers before drawing a biological
conclusion. A red-channel image alone does not give a total-cell count or a percentage
of viable cells. See [Thermo Fisher's PI overview](https://www.thermofisher.com/us/en/home/life-science/cell-analysis/fluorophores/propidium-iodide.html).

Automatic counting uses a Difference of Gaussians (DoG) filter, then chooses a binary
Otsu threshold from each image's positive filter response. It starts with a cell
diameter of **10 px** and **k = 4**. It uses image pixels, without looking up a filename
or a reference count. Raw/DoG display contrast does not change the count.

On the eight calibration images, the chosen automatic method improves agreement over
the former 0.10 cutoff, but a fixed 0.12 cutoff agrees better with those same uncertain
totals. Automatic selection therefore remains provisional. This small calibration set
cannot tell you how accurate the count will be on a new experiment. The complete
comparison and saved evidence are in
[docs/AUTOMATIC_DETECTOR_EXPERIMENT.md](docs/AUTOMATIC_DETECTOR_EXPERIMENT.md).

## Follow your curiosity

- [docs/USAGE.md](docs/USAGE.md): count, inspect, export, and recover partial work.
- [docs/SCREENSHOTS.md](docs/SCREENSHOTS.md): see the saloon, real markers, and processing views.
- [docs/WORKFLOW_MODES.md](docs/WORKFLOW_MODES.md): understand one-image and multi-image behavior.
- [docs/AUTOMATIC_DETECTOR_EXPERIMENT.md](docs/AUTOMATIC_DETECTOR_EXPERIMENT.md): read the automatic-method evidence and limitations.
- [docs/EXPERIMENT_DESIGN.md](docs/EXPERIMENT_DESIGN.md): explore the advanced comparison design.
- [docs/VERIFICATION.md](docs/VERIFICATION.md): distinguish engineering checks from biological validation.

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

The server builds the GitHub Pages artifact and prints a local URL. Open it and select
**Try an example**, or **Choose images** followed by **Count cells**.
For a production build alone, run `./build_github_pages.sh`. If a managed machine blocks
the default wasm-pack cache, use
`WASM_PACK_CACHE=/private/tmp/wasm-pack-cache ./build_github_pages.sh`.

The browser decodes image pixels and sends them to a worker. Rust/Wasm prepares the
red signal, computes DoG, chooses this image's threshold, and returns centers plus
saved analysis metadata. Native and Wasm callers share the prepared response and
detector. The runtime does not read calibration references.

```sh
./check_codebase.sh
cargo test --manifest-path rust/Cargo.toml
./run_playwright_tests.sh
```

For optional Python characterization, install NumPy, SciPy, and Pillow, then run:

```sh
source source_me.sh && python3 tools/characterize_images.py
```

Read [docs/CODE_ARCHITECTURE.md](docs/CODE_ARCHITECTURE.md) and
[docs/FILE_STRUCTURE.md](docs/FILE_STRUCTURE.md) for the code map,
[docs/DETECTOR_EXPERIMENT.md](docs/DETECTOR_EXPERIMENT.md) for the DoG equations,
and [docs/WASM_PERFORMANCE.md](docs/WASM_PERFORMANCE.md) for comparison measurements.
[docs/DESIGN_DECISIONS.md](docs/DESIGN_DECISIONS.md) records settled design;
[docs/CHANGELOG.md](docs/CHANGELOG.md) records dated changes.

The TypeScript 7 compiler uses the TypeScript 6 compatibility API for ESLint.
Lockfiles record installed npm and Cargo releases. `build_github_pages.sh` emits
`dist/`, including the worker, example image, and Wasm binary. The root
[deploy-pages.yml](deploy-pages.yml) remains the editable seed for
[.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml).

</details>

## Credits and license

Jaren supplied the fluorescence images. The interface uses original frontier SVG art,
CSS wood and poster styling, and system fonts.

License text: [LICENSE.MIT](LICENSE.MIT) (MIT). Its copyright attribution is still unfilled.

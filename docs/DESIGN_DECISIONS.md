# Design decisions

<!-- VENDORED HEADER: START -->
Record each durable decision about how this code and repository are shaped, once it is settled, with
the reasoning a later reader needs. Guidance Neil Voss states belongs in
[HUMAN_GUIDANCE.md](HUMAN_GUIDANCE.md), dated history in `docs/CHANGELOG.md`, open discussion in
`docs/active_plans/decisions/`. [PROPAGATED HEADER - ENTRIES BELOW ARE YOURS]
<!-- VENDORED HEADER: END -->

Write each decision as a level-three heading with these four fields. `Owner` names the
authoritative code or contract document, rather than a person.

```markdown
### <decision title>

**Decision.** <the durable direction>

**Why.** <the reason it was chosen>

**Consequence.** <the constraint a future change preserves>

**Owner.** <the authoritative code or contract doc>
```

### Frontend module ownership

**Decision.** Keep `src/main.ts` focused on startup and event wiring. The workflow
controller owns the selected image, results, active/cancelled state, and comparison
state. It coordinates two presentation modules and one worker client.

**Why.** The 958-line entry point mixed analysis, rendering, transport, and export,
making unrelated changes difficult to review and approaching the source-file limit.

**Consequence.** `counter_controller.ts` coordinates upload, single/batch analysis,
comparison, and applying results. `detector_client.ts` owns browser decoding, RGBA
extraction, worker lifetime, and request/reply handling. `image_workspace.ts` owns
the ledger, image summary, overlays, zoom, and CSV. `comparison_panel.ts` owns
comparison rendering and progress/statistical feedback. `detector_settings.ts`
owns reading, rounding, and validation of settings; `count_statistics.ts` owns
count statistics and formatting. `counter_elements.ts` catalogs DOM handles.
Types live with their owning modules. This adds no framework, event bus, or dependency.
The existing `image_viewer.ts` and `workflow_modes.ts` retain their responsibilities.

**Owner.** `src/main.ts`, `src/counter_controller.ts`, `src/detector_client.ts`,
`src/image_workspace.ts`, and `src/comparison_panel.ts`

### Browser-local image processing

**Decision.** Decode JPEG and PNG images in the browser and process their RGBA pixels in
a WebAssembly worker.

**Why.** A static GitHub Pages site has no server-side image store, and the supplied images
are large enough that processing must not freeze the user interface.

**Consequence.** Uploaded images do not leave the browser. The worker owns sequential batch
processing and returns compact center-coordinate results.

**Owner.** `src/detector_client.ts`, `src/counter_controller.ts`, and `src/worker.ts`

### Prepared images during comparison

**Decision.** Transfer image pixels once per comparison worker. Rust owns the prepared
red signal and retains only the most recent diameter/k DoG response. Threshold-only
trials reuse that response; changes to diameter/k replace it before computing the next.

**Why.** Copying an 18-megapixel RGBA image for every comparison trial wastes memory
bandwidth and repeats signal preparation and Gaussian filtering without changing data.

**Consequence.** Requests remain sequential, with individual results, progress, Apply,
and cancellation. A new image replaces and frees the previous prepared image; a bad
replacement leaves no stale image available. Worker termination releases the session.
The signal and latest response retain 8 bytes per pixel together, plus temporary blur
buffers during processing; there is no cache of multiple images or scale responses.
The standalone detector and preview exports keep their existing behavior. Browser DOM,
decoding, and Canvas operations remain in TypeScript. Measurements and the boundary
contract are in [WASM_PERFORMANCE.md](WASM_PERFORMANCE.md).

**Owner.** `rust/src/prepared_image.rs`, `src/worker.ts`, and `src/counter_controller.ts`

### Matched Difference of Gaussians detector

**Decision.** Extract red signal and detect local maxima in a float Difference of Gaussians
response. Derive Gaussian scales from target cell radius and k using equation 4 from Voss
et al., *DoG Picker and TiltPicker*.

**Why.** This is the user-selected method and it separates nearby bright objects better than
counting raw thresholded connected components.

**Consequence.** The verified starting values are a 10-pixel target diameter, k = 4, and
response threshold 0.10. Single-image comparison starts with a 15-run central composite
design: eight factorial corners, six axial points, and one center. The default 21 runs
add six inner-axis points. Users can choose 15-100 runs; larger budgets add deterministic
settings spread across the range. For three factors, alpha = 8^(1/4),
following the [NIST central composite design guidance](https://www.itl.nist.gov/div898/handbook/pri/section3/pri3361.htm).
Diameter, k, and threshold vary in logarithmic coordinates. The default outer ranges
are 5 to 20 pixels, k = 2 to 8, and threshold 0.025 to 0.4; when a requested window would
exceed detector bounds, it recenters at the bounded range's geometric mean. Actual run
settings are rounded to two decimals for diameter/k and five for threshold, so the table,
processing, and CSV agree. This quantization approximates the continuous design.
Thresholds must exceed 0.00001, making 0.00002 the smallest five-decimal setting.
The interface displays the processed start and actual center/ranges.
The representative median run is the actual tested run closest to the median successful count,
with ties resolved by logarithmic distance from the center. Auto-tune may apply that run to a
batch. This describes a representative result, not an accuracy optimizer or quadratic-model
optimizer. The summary keeps mean, median, and population standard deviation across successful
runs, with those statistics also shown in the table footer. The expanded rounded design
is not claimed to be exactly rotatable or orthogonal.

**Owner.** `rust/src/lib.rs` and `docs/DETECTOR_EXPERIMENT.md`

### Minimal Rust image stack

**Decision.** Use `image`, `imageproc`, and `wasm-bindgen`; leave JPEG/PNG decoding to the
browser.

**Why.** `imageproc` supplies the necessary float Gaussian operation while the browser
already decodes the supported upload formats.

**Consequence.** Rust receives decoded RGBA pixels and its public Wasm boundary validates
dimensions, buffer length, and numeric detector inputs.

**Owner.** `rust/Cargo.toml` and `rust/src/lib.rs`

### Saloon entrance and Western surfaces

**Decision.** Open on an illustrated saloon with one Enter saloon button. Keep the
counter hidden until entry, then focus its heading. Use original SVG art, CSS wood
surfaces, and aged-paper wanted posters and results. Use the full product name,
Red Dead Cell Counter, in the browser title, entrance, workbench, and README heading.

**Why.** The requested Western theme needs a recognizable place and materials.
Local assets keep the static tool self-contained.

**Consequence.** Entry requires one click or keyboard activation on each page load.
Decorative art stays silent to assistive technology, door motion honors reduced
motion, and microscopy images retain a neutral dark viewing surface.

**Owner.** `src/index.html`, `src/style.css`, `src/assets/`, and `src/main.ts`

### Raw, DoG, and threshold image inspection

**Decision.** Offer Raw, DoG, and Threshold tabs above one shared image canvas.
Raw displays the original RGB pixels. Rust generates a contrast-stretched grayscale
DoG display and a binary mask from the original DoG response and the actual cutoff.

**Why.** Researchers need to inspect what the filter and cutoff retain when tuning
cell detection. The image views must agree with the count's processing settings.

**Consequence.** Counted images use their stored applied settings; unprocessed images
use valid rounded controls. Derived views retain the original pixel dimensions and
share zoom and marker controls. Only the selected image's two byte-per-pixel planes
are cached. File/settings changes invalidate that cache, and obsolete preview work
is cancelled. Display contrast stretching does not affect thresholding or counts.
Mouse and pen dragging pan the existing scroll viewport, with pointer capture and
grab/grabbing cursors. Keyboard scrolling, scrollbars, and native touch gestures remain
available; panning does not alter image coordinates, detection data, or zoom.

**Owner.** `rust/src/lib.rs`, `src/worker.ts`, `src/image_viewer.ts`, and `src/image_workspace.ts`

### Researcher workflow and result context

**Decision.** Separate Single image tuning/inspection from Batch processing/export with
an explicit mode selector, using shared files, settings, counts, and viewer state.
Single image exposes Images and Tune and inspect; Batch adds Count and export.
Use a compact workbench masthead with the full name, subtitle, and small skull.
Keep Compare settings prominent, disable analysis until files exist, and place the
selected filename, count, and applied settings directly above its image. Show comparison
statistics before the detailed runs and offer a direct return to inspect applied picks.

**Why.** The previous flat toolbar gave several actions similar emphasis, the large
masthead displaced the work, and the count's filename and settings required consulting
other panels. Editing controls must not suggest that an existing count has changed.

**Consequence.** The ledger uses native filename buttons with a current-image state.
The viewer labels stale controls while preserving the actual count's settings. Batch
completion remains separate from single-image inspection. Technical design ranges stay
available in a disclosure, alongside the complete run table and statistics footer.
Mode switching preserves work and is disabled while processing. Explicit handoffs carry
current settings to Batch or a selected batch image back to Single image. Batch auto-tuning
retains visible comparison progress; detailed runs are inspected in Single image. See
[WORKFLOW_MODES.md](WORKFLOW_MODES.md) for the task model and acceptance criteria.

**Owner.** `src/workflow_modes.ts`, `src/index.html`, `src/style.css`,
`src/counter_controller.ts`, `src/image_workspace.ts`, and `src/comparison_panel.ts`

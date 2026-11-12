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

### Retain detector after adaptive experiment

**Decision.** Retain the peak detector after the 144-case adaptive blob experiment.
Its manual baseline remains 10 px, k=4, cutoff 0.10; the separate automatic threshold
experiment below determines the beginner Count cells path. Preserve the research harness and negative result rather
than porting a rejected adaptive policy to Rust/Wasm or adding its mask/CSV interface.

**Why.** Local area refinement improves default count agreement but fails nearby-cutoff
sensitivity. Small-parent processing moves A501 outside its default uncertainty band.
Compactness and inertia fail their incremental comparisons. Independent selection and visual
reviews accept the negative result, including visible loss of lobes during consolidation.

**Consequence.** Reusable blob geometry remains available without becoming a shipping cell
acceptance rule. The experiment's interval loss evaluates agreement with uncertain ImageJ
totals; it does not establish biological truth or a new production result contract. A future
adaptive method must preserve the lineage between its actual mask, emitted centers, settings,
and exported provenance; this caution is not an implemented adaptive recipe. The separate automatic threshold experiment evaluates image-specific cutoffs without
reviving the rejected adaptive blob policies.

**Owner.** [ADAPTIVE_BLOB_EXPERIMENT.md](ADAPTIVE_BLOB_EXPERIMENT.md),
[adaptive_blob_processing_plan.md](active_plans/active/adaptive_blob_processing_plan.md),
and `rust/src/lib.rs`

### Rust blob measurements

**Decision.** Measure eight-connected threshold-mask components in portable Rust and expose
the same routine through the Wasm worker. Area/perimeter roundness and binary covariance
inertia ratio remain distinct, intensity-independent shape measurements.

**Why.** The static Pages app cannot run the Python research implementation. The real-image
experiment shows shape differences between existing one-pick and multi-pick blobs, warranting
a reusable measurement routine before testing whether those cues improve detection.

**Consequence.** Zero mask bytes are background and all nonzero bytes are foreground. Compact
eight-value records use original-pixel coordinates; degenerate inertia reports NaN. Perimeter
follows the documented Appion raster convention, including values above one for small shapes.
Calls retain no component cache. The current DoG detector still chooses centers independently;
area or shape is not a new acceptance rule. Python remains the parity oracle and experiment tool.

**Owner.** `rust/src/blob_features.rs`, `src/worker.ts`, and
[BLOB_MEASUREMENTS.md](BLOB_MEASUREMENTS.md)

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
`image_viewer.ts` retains canvas responsibilities; file selection length determines
single/multiple scope without a separate workflow-mode module.

**Owner.** `src/main.ts`, `src/counter_controller.ts`, `src/detector_client.ts`,
`src/image_workspace.ts`, and `src/comparison_panel.ts`

### Browser-local image processing

**Decision.** Decode JPEG and PNG images in the browser and process their RGBA pixels in
a WebAssembly worker.

**Why.** A static GitHub Pages site has no server-side image store, and the supplied images
are large enough that processing must not freeze the user interface.

**Consequence.** Uploaded images do not leave the browser. The controller coordinates sequential batch
requests; the worker performs numerical analysis and returns compact center-coordinate results.

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

**Consequence.** The manual starting values are a 10-pixel target diameter, k = 4, and
response threshold 0.10. Automatic counting starts with the same diameter/k and fits
its own seed threshold independently for each image. Required per-image refinement starts with a 15-run central composite
design: eight factorial corners, six axial points, and one center. The default 21 runs
add six inner-axis points. Users can choose 15-100 runs; larger budgets add deterministic
settings spread across the range. For three factors, alpha = 8^(1/4),
following the [NIST central composite design guidance](https://www.itl.nist.gov/div898/handbook/pri/section3/pri3361.htm).
Diameter, k, and threshold vary in logarithmic coordinates. For the illustrative manual 10/4/0.10 starting point, the outer ranges
are 5 to 20 pixels, k = 2 to 8, and threshold 0.025 to 0.4; when a requested window would
exceed detector bounds, it recenters at the bounded range's geometric mean. Actual run
settings are rounded to two decimals for diameter/k and five for threshold, so the table,
processing, and CSV agree. This quantization approximates the continuous design.
Thresholds must exceed 0.00001, making 0.00002 the smallest five-decimal setting.
The interface displays the processed start and actual center/ranges.
The representative median run is the actual tested run closest to the median successful count,
with ties resolved by logarithmic distance from the center. Applying that run changes only the selected image and saves manual provenance.
This describes a representative result, not an accuracy optimizer, quadratic-model
optimizer, or batch parameter selector. The summary keeps mean, median, and population standard deviation across successful
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

**Decision.** Open on an illustrated saloon with Choose images and Try an example.
Choosing files enters the counter directly and focuses its heading; the example
lazily loads real A501 pixels and runs the same automatic pipeline. Use original SVG art, CSS wood
surfaces, and aged-paper wanted posters and results. Use the full product name,
Red Dead Cell Counter, in the browser title, entrance, workbench, and README heading.

**Why.** The requested Western theme needs a recognizable place and materials.
Local assets keep the static tool self-contained.

**Consequence.** The primary entry action starts file selection; no extra entry button
stands between arrival and the task. Decorative art stays silent to assistive technology, door motion honors reduced
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

### Required per-image refinement

**Decision.** Make Refine and count the primary action for all selected images, with
Refine selected image for one image. Keep diameter, k, threshold, and run-budget controls
visible in the main workbench for graduate biology researchers with laboratory experience.
Count once with these settings is a selected-image manual action.

**Why.** Refinement is the required workflow. Researchers need to inspect parameter
sensitivity alongside the resulting detections without discovering a separate Advanced mode.
A representative median count remains an estimate, not evidence of biological accuracy.

**Consequence.** For each fresh image, use binary Otsu at the visible starting diameter/k
as a seed, run the existing 15-100-setting logarithmic design (default 21), select the
existing representative median run, and rerun its settings through the prepared-image cache.
A no-signal seed returns zero without design trials. Diameter/k are initial estimates,
not automatically measured cell size. The editable threshold is for manual counting;
automatic refinement fits its own seed. Show mean, median, population SD, and review notices
above a native collapsible trial table. Selection restores each image's saved trials;
applying another trial detects fresh centers and marks that saved result manual.

**Owner.** `src/refine_image.ts`, `src/counter_controller.ts`, `src/index.html`,
`src/comparison_panel.ts`, and [refinement_workflow.md](active_plans/reports/refinement_workflow.md)

### Provisional per-image automatic threshold

**Decision.** Use binary Otsu on each image's positive DoG response to seed the required
refinement. Native and Wasm callers share `PreparedImage` and the numerical response.
No-signal results retain seed provenance. Completed refinement uses `dog_ccd_median`,
version `dog-refinement-1`, and `provisional_refinement`.

**Why.** Binary Otsu ranks first among the three frozen automatic candidates on eight
calibration images. Its mean outside-interval loss is 2.524% with three images outside,
compared with 4.187% and four outside for fixed 0.10. Fixed 0.12 nevertheless puts all
eight inside and has lower center MAPE (5.188% versus 8.120% automatic). The evidence
supports a provisional implementation, not a general accuracy claim.

**Consequence.** Threshold selection receives pixels and diameter/k, without filenames,
reference totals, or a batch-derived cutoff. Diameter 10 px and k 4 are starting values;
Visible diameter/k edits affect future seeds. Histogram selection, native center detection,
preview masks, and reported cutoff share one numerical contract. Research alternatives
and negative results remain reproducible. The eight-image experiment calibrates the seed
only; it does not validate the combined seed-plus-refinement pipeline.
ImageJ totals are uncertain calibration evidence, not biological truth or independent
validation. The complete method and evidence belong in
[AUTOMATIC_DETECTOR_EXPERIMENT.md](AUTOMATIC_DETECTOR_EXPERIMENT.md).

**Owner.** `rust/src/automatic_threshold.rs`, `rust/src/prepared_image.rs`,
`src/worker.ts`, and [AUTOMATIC_DETECTOR_EXPERIMENT.md](AUTOMATIC_DETECTOR_EXPERIMENT.md)

### Saved analysis owns result provenance

**Decision.** Store centers with typed `SavedAnalysis`: actual settings, automatic/manual
mode, method, version, review reasons, and no-signal state. Optional per-image refinement
metadata retains starting settings, seed method, requested budget, each trial's settings,
kind, count or error, elapsed time, and representative/selected indices. Display, derived previews,
and CSV read this saved record rather than current editable controls.

**Why.** Per-image thresholds and selected-image manual research make global controls
insufficient to describe a result. Failed or cancelled reruns must preserve usable
previous counts without presenting them as a successful new analysis.

**Consequence.** Save a replacement analysis only when processing succeeds. Retain
previous centers and metadata on failure/cancellation, alongside the new attempt status
and error. Export every selected row, including waiting/failed/cancelled rows, through
the same one-file or partial CSV path. CSV records provenance for each saved count;
it is not a complete session reload format. CSV appends requested/successful/failed run
counts, seed method/threshold, mean, median, population SD, minimum, and maximum.
Retain only final centers, not a center array per trial. Editing controls never relabels
saved analyses. Flag `refinement_sensitive` when the successful count range exceeds 10%
of the chosen count; this is a review policy, not a validated accuracy threshold.

**Owner.** `src/analysis_types.ts`, `src/counter_controller.ts`,
`src/image_workspace.ts`, and `src/worker.ts`

### Descriptive saved-object morphology

**Decision.** Measure all 8-connected components of the actual final DoG threshold mask
once before saving each successful analysis, including manual trial application. Keep the
legacy eight-value primitive and use a separate 14-value detailed record with mean squared
radius, exclusive bounds, edge flags, and sparse exact center membership. Save typed object
measurements with the count and its provenance as one complete snapshot.

**Why.** Researchers need descriptive area, roundness, and moment-related information
without changing the existing center detector or mislabeling clusters as individual cells.

**Consequence.** The visible mean, median, population SD, and per-metric finite n use
single-center components away from image edges as an explicitly approximate population.
All-object/category counts and full object CSV retain excluded objects; cluster areas
remain whole. Binary mean squared radius is the covariance trace, distinct from inertia
ratio and the historical intensity-weighted Appion moment. Real raw-image challenge crops
show bounds and accepted centers and navigate the viewer without new detection. Geometry
neither splits boundaries nor rejects shapes. Failure or cancellation preserves the prior
complete analysis. Current biological accuracy remains unvalidated.

**Owner.** [BLOB_MEASUREMENTS.md](BLOB_MEASUREMENTS.md),
[blob_features.rs](../rust/src/blob_features.rs), and
[morphology_statistics.ts](../src/morphology_statistics.ts).

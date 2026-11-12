# Code architecture

## Overview

A static TypeScript interface decodes JPEG/PNG files and runs Rust/Wasm in a worker.
The workflow controller coordinates selection, sequential analysis, cancellation, and
presentation. The runtime receives pixels and settings; it does not read filenames,
calibration totals, or research output files when choosing a threshold.

## Major components

| Component | Responsibility |
| --- | --- |
| [main.ts](../src/main.ts) | Startup and event wiring. |
| [counter_controller.ts](../src/counter_controller.ts) | Selection, lazy example loading, automatic/manual runs, comparison, and cancellation. |
| [refine_image.ts](../src/refine_image.ts) | Shared per-image Otsu seed, parameter design, representative selection, and final rerun. |
| [analysis_types.ts](../src/analysis_types.ts) | Discriminated worker messages and typed immutable saved analysis metadata. |
| [detector_client.ts](../src/detector_client.ts) | Browser decoding, RGBA extraction, worker lifecycle, request/reply transport. |
| [worker.ts](../src/worker.ts) | Validated Wasm calls and conversion of owned native results into typed replies. |
| [prepared_image.rs](../rust/src/prepared_image.rs) | Shared red signal, one cached DoG response, and native/Wasm automatic entry points. |
| [automatic_threshold.rs](../rust/src/automatic_threshold.rs) | Image-specific cutoff fitting and diagnostic reasons. Production uses binary Otsu. |
| [lib.rs](../rust/src/lib.rs) | Boundary validation, shared red-signal/DoG operations, local maxima, spacing, and preview planes. |
| [image_workspace.ts](../src/image_workspace.ts) | Saved ledger, selected-image summary, viewer coordination, and CSV export. |
| [image_viewer.ts](../src/image_viewer.ts) | Canvas views, marker overlays, zoom, and panning. |
| [comparison_panel.ts](../src/comparison_panel.ts) | Refinement progress, per-image trial restoration, statistics, and manual application feedback. |
| [experiment_design.ts](../src/experiment_design.ts) | Deterministic 15-100 point parameter design, default 21. |
| [blob_features.rs](../rust/src/blob_features.rs) | Legacy binary geometry and detailed final-object measurements with exact center membership. |
| [morphology_types.ts](../src/morphology_types.ts) | Detailed worker-record decoding and readonly saved object measurements. |
| [morphology_statistics.ts](../src/morphology_statistics.ts) | Finite per-metric statistics and deterministic challenge selection. |
| [morphology_panel.ts](../src/morphology_panel.ts) | Selected-image insight table, raw challenge crops, and full object CSV. |
| [csv_export.ts](../src/csv_export.ts) | Shared CSV quoting and browser download. |

## Counting data flow

1. Choose images opens the file picker directly from the saloon. Try an example lazily
   fetches [example_a501.jpg](../src/assets/example_a501.jpg) and uses the same pipeline.
2. Refine and count processes every selected image sequentially; Refine selected image
   processes one. Fresh RGBA and visible initial diameter/k go to the shared refinement
   operation. The manual threshold entry does not override its automatic seed.
3. Rust prepares `max(0, R/255 - max(G,B)/255)` and the float DoG response. Binary Otsu
   fits a seed cutoff independently per image. A no-signal seed returns zero without trials.
4. TypeScript runs the existing 15-100-point design around the seed, using the prepared
   worker image. Each trial records count/settings/kind/elapsed time or error. The existing
   selector chooses a successful representative median run and reruns it for final centers.
5. After final detection, the controller requests geometry once from the actual final
   settings and copied accepted centers. Rust labels that raw-response threshold mask,
   measures all components, and associates centers by exact foreground pixels. The worker
   extracts arrays and frees owned native results in `finally`. Only a complete count,
   settings, and geometry snapshot replaces the saved analysis. Successful refinement saves
   final centers and `SavedAnalysis.morphology` with `SavedAnalysis.refinement`: starting settings,
   seed method, requested budget, trial metadata, and representative/selected indices.
   It retains no per-trial center arrays. Method/version are `dog_ccd_median` /
   `dog-refinement-1`; every completed refinement carries `provisional_refinement`.
6. The ledger, summary, views, restored trial panel, and CSV use that saved analysis.
   `refinement_sensitive` flags a count range above 10% of the chosen count as a review
   policy. Failed or cancelled reruns preserve prior counts and their provenance.

Threshold-only operations reuse the prepared response; changing diameter/k replaces it.
The shared native/Wasm response prevents a second numerical implementation in research
probes. Only one image's signal/response is retained per worker, rather than a batch cache.
See [WASM_PERFORMANCE.md](WASM_PERFORMANCE.md).

## Selected-image inspection

Visible controls and count statistics support the main research workflow; the full trial
table uses a native disclosure below feedback. Count once with these settings affects
only the selected image and saves manual provenance. Applying a saved trial performs fresh
detection before saving manual provenance. Edited controls apply to later runs; they never
relabel existing results. Diameter/k are initial estimates, not measured cell size.

CSV preserves its original columns and appends ten refinement fields:
`refinement_runs_requested`, `refinement_runs_successful`, `refinement_runs_failed`,
`seed_method`, `seed_threshold`, `count_mean`, `count_median`, `count_sd`, `count_min`,
and `count_max`. These summarize sensitivity to settings, not independent measurements.

The saved morphology panel summarizes single-center components away from image edges;
finite observations determine each metric's n. All components remain available through
the separate object CSV. Challenge crops show raw pixels, bounds, and existing accepted
centers; their Inspect action only changes the main view. No shape-based acceptance or
cluster splitting is added. Eleven morphology columns follow the 24 existing count CSV
columns. [BLOB_MEASUREMENTS.md](BLOB_MEASUREMENTS.md) owns geometry and export definitions.

## Evidence and boundaries

Native Rust tests, typed browser checks, and real-image parity checks test implementation
behavior. [AUTOMATIC_DETECTOR_EXPERIMENT.md](AUTOMATIC_DETECTOR_EXPERIMENT.md) records native
selection evidence; [VERIFICATION.md](VERIFICATION.md) owns current execution receipts.
The eight-image Otsu experiment supports seed calibration only. The combined refinement
pipeline has no independent biological or localization validation. Current TypeScript,
focused lint/format, production-build, independent source-review, and actual-browser
documentation-capture receipts are recorded in [VERIFICATION.md](VERIFICATION.md).
The current morphology work and remaining capture/build evidence are tracked in
[morphology_insights.md](active_plans/reports/morphology_insights.md).
Application suites are not run for this refresh; historical test receipts do not validate
this changed workflow.

Keep orchestration in the controller, numerical method changes in Rust, and presentation
in the workspace/viewer/comparison modules. No workflow-mode synchronization layer is
needed: the current file selection determines scope.

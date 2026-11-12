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
| [analysis_types.ts](../src/analysis_types.ts) | Discriminated worker messages and typed immutable saved analysis metadata. |
| [detector_client.ts](../src/detector_client.ts) | Browser decoding, RGBA extraction, worker lifecycle, request/reply transport. |
| [worker.ts](../src/worker.ts) | Validated Wasm calls and conversion of owned native results into typed replies. |
| [prepared_image.rs](../rust/src/prepared_image.rs) | Shared red signal, one cached DoG response, and native/Wasm automatic entry points. |
| [automatic_threshold.rs](../rust/src/automatic_threshold.rs) | Image-specific cutoff fitting and diagnostic reasons. Production uses binary Otsu. |
| [lib.rs](../rust/src/lib.rs) | Boundary validation, shared red-signal/DoG operations, local maxima, spacing, and preview planes. |
| [image_workspace.ts](../src/image_workspace.ts) | Saved ledger, selected-image summary, viewer coordination, and CSV export. |
| [image_viewer.ts](../src/image_viewer.ts) | Canvas views, marker overlays, zoom, and panning. |
| [comparison_panel.ts](../src/comparison_panel.ts) | Manual-comparison progress, rows, statistics, and application feedback. |
| [experiment_design.ts](../src/experiment_design.ts) | Deterministic 15-100 point manual parameter design. |
| [blob_features.rs](../rust/src/blob_features.rs) | Reusable connected-mask geometry; independent of production center acceptance. |

## Counting data flow

1. Choose images opens the file picker directly from the saloon. Try an example lazily
   fetches [example_a501.jpg](../src/assets/example_a501.jpg) and uses the same pipeline.
2. The controller infers single/multiple scope from selection length. Count cells
   decodes each image and submits its RGBA pixels with diameter/k to the worker.
3. Rust prepares `max(0, R/255 - max(G,B)/255)` and the float DoG response. The production
   binary Otsu selector fits the positive response histogram independently for each image.
4. The shared center detector uses the actual rounded cutoff. The automatic result
   returns centers, cutoff, method/version, diagnostic reasons, and no-signal state.
5. The worker copies result data into its reply and frees native result objects. The
   controller saves centers and a `SavedAnalysis` together only after successful processing.
6. The ledger, summary, derived image views, and CSV use that saved analysis. Failed or
   cancelled reruns preserve prior saved counts with their actual provenance.

Threshold-only operations reuse the prepared response; changing diameter/k replaces it.
The shared native/Wasm response prevents a second numerical implementation in research
probes. Only one image's signal/response is retained per worker, rather than a batch cache.
See [WASM_PERFORMANCE.md](WASM_PERFORMANCE.md).

## Manual research path

Advanced manual runs and comparisons affect only the selected image. Comparison uses
prepared-image reuse and reports each actual trial. Applying the representative median
run saves manual provenance; it does not optimize accuracy or set batch parameters.
Edited controls apply to later runs while existing results retain their saved settings.

## Evidence and boundaries

Native Rust tests, typed browser checks, and real-image parity checks test implementation
behavior. [AUTOMATIC_DETECTOR_EXPERIMENT.md](AUTOMATIC_DETECTOR_EXPERIMENT.md) records native
selection evidence; [VERIFICATION.md](VERIFICATION.md) owns current execution receipts.
Every automatic result carries `provisional_calibration`. Eight uncertain calibration
totals are insufficient for independent biological validation or localization accuracy.

Keep orchestration in the controller, numerical method changes in Rust, and presentation
in the workspace/viewer/comparison modules. No workflow-mode synchronization layer is
needed: the current file selection determines scope.

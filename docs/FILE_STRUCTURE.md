# File structure

## Top-level layout

| Path | Purpose |
| --- | --- |
| [README.md](../README.md) | Graduate biology researcher browser start and developer entry commands. |
| [src/](../src/) | TypeScript UI, worker transport, HTML/CSS, and local artwork/example. |
| [rust/](../rust/) | Portable detector library, Wasm bindings, and native experiment probes. |
| [IMAGES/](../IMAGES/) | Original fluorescence calibration images. |
| [devel/](../devel/) | Build support, research runners, and repository maintenance tools. |
| [tools/](../tools/) | Optional characterization and document utilities. |
| [tests/](../tests/) | Repository checks, TypeScript checks, and Playwright browser workflows. |
| [docs/](./) | Durable usage, method, architecture, design, and verification docs. |
| [package.json](../package.json) | Frontend tooling dependencies and scripts. |
| [build_github_pages.sh](../build_github_pages.sh) | Canonical production artifact builder. |
| [run_web_server.sh](../run_web_server.sh) | Builds and serves the production artifact locally. |
| [source_me.sh](../source_me.sh) | Required environment for Python commands in this repository. |

## Source organization

[main.ts](../src/main.ts) wires events to [counter_controller.ts](../src/counter_controller.ts).
[refine_image.ts](../src/refine_image.ts) owns the shared per-image seed/design/final-rerun
operation. [analysis_types.ts](../src/analysis_types.ts) owns typed worker and saved-analysis
contracts, including metadata-only `RefinementRun` and per-image `Refinement` records.
[image_workspace.ts](../src/image_workspace.ts) and [image_viewer.ts](../src/image_viewer.ts)
own the ledger, export, and inspection; [comparison_panel.ts](../src/comparison_panel.ts)
owns refinement feedback and restoration of saved per-image trials. [CODE_ARCHITECTURE.md](CODE_ARCHITECTURE.md) maps the rest.

Selected-image scientific insights live in
[morphology_types.ts](../src/morphology_types.ts),
[morphology_statistics.ts](../src/morphology_statistics.ts), and
[morphology_panel.ts](../src/morphology_panel.ts). The feature stylesheet
[morphology.css](../src/morphology.css) is copied into the static build.
[csv_export.ts](../src/csv_export.ts) supplies common CSV download handling.
[BLOB_MEASUREMENTS.md](BLOB_MEASUREMENTS.md) defines mask geometry, sample populations,
and export fields. [morphology_insights.md](active_plans/reports/morphology_insights.md)
tracks implementation ownership and evidence for the current change.

The shared numerical path lives in [rust/src/](../rust/src/). Its prepared image and
automatic threshold modules serve native research and Wasm. Native probes live in
[rust/examples/](../rust/examples/); [devel/](../devel/) runs experiments and evaluates
saved predictions against calibration totals afterward.

The shipped example is [example_a501.jpg](../src/assets/example_a501.jpg), copied from
[A501.jpg](../IMAGES/A501.jpg). It loads on request, rather than on every page visit.
Western SVG source art remains editable in [src/assets/](../src/assets/).

## Generated artifacts

These paths are build or experiment outputs and are ignored by Git:

- `dist/`: complete static Pages artifact, worker, Wasm, and copied assets.
- `rust/pkg/`: wasm-pack bindings and binary; `rust/target/`: Cargo build output.
- `generated/`: experiment predictions, evaluations, overlays, and capture receipts.
- `test-results/` and `playwright-report/`: browser test outputs.
- `node_modules/`: installed frontend dependencies.

Published documentation images are retained under [screenshots/](screenshots/), in
WebP at quality 90. [capture_readme.mjs](../tests/playwright/capture_readme.mjs) recreates
them from a served production build.

## Where work belongs

- Put UI behavior in the existing source module that owns it; keep startup small.
- Put shared detector behavior in Rust, and characterization runners under `devel/`.
- Add meaningful browser behavior checks under [tests/playwright/](../tests/playwright/).
- Keep durable instructions in `docs/`, dated outcomes in [CHANGELOG.md](CHANGELOG.md),
  human-stated preferences in [HUMAN_GUIDANCE.md](HUMAN_GUIDANCE.md), and settled code
  decisions in [DESIGN_DECISIONS.md](DESIGN_DECISIONS.md).
- Working plans and reports belong in the existing `docs/active_plans/` categories;
  completed historical work belongs in `docs/archive/`.

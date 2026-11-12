# Morphology insights

## Scope and scientific boundary

Expose descriptive geometry from the final saved DoG threshold mask and illustrate real
challenging regions. Counts still come from the existing maxima and spacing algorithm.
Objects are connected threshold regions, not independently validated segmented cells.
Single-center interior objects approximate individual cells for summary purposes; this
population choice is an implementation decision, not a human-specified biological rule.
See [BLOB_MEASUREMENTS.md](../../BLOB_MEASUREMENTS.md) for the runtime and export contract.

## Ownership and completion

| Work | Owner | Reviewable result | Evidence status |
| --- | --- | --- | --- |
| Detailed geometry | Rust engine | 14-value records, bounds/edge/trace, sparse exact membership; old eight-value API retained | Complete; Cargo check all targets, all-target Clippy, and Wasm check pass |
| Typed bridge | Browser integration | Measurement request, copied centers, owned-result cleanup, readonly saved geometry | Complete; both TypeScript configurations and focused lint/format checks pass |
| Final analysis commit | Controller integration | Measure final settings once, then save centers/settings/geometry together, including manual Apply | Complete; source review accepts saved snapshot and failure/cancellation behavior |
| Statistics and CSV | Scientific insights | Finite per-metric n, interior single-center summaries, all-object CSV, eleven count CSV additions | Complete; real CSV rows conserve accepted centers and saved provenance |
| Inspection interface | Scientific insights | Ledger metrics, raw crops, bounds/centers, navigate main viewer | Complete; real A501/H501 captures show metrics and count-preserving navigation |
| Contract and guidance | Documentation | Updated usage, geometry, architecture, structure, decisions, and human guidance | Complete; source reconciled with implementation |
| Independent review | Review owners | Engine, bridge, statistics, UI, and new visual assets | Complete; morphology_spec_review and morphology_quality_review accept with no blockers |
| Production evidence | Root integration | Canonical build and real browser documentation captures | Complete; regenerated release Wasm and canonical build pass; receipts in [VERIFICATION.md](../../VERIFICATION.md) |

Manager integration review: ACCEPT (2026-11-12). Final source, contract, README,
walkthrough, and the 2026-11-12T21:30:42.355Z capture receipts agree. Independently
inspected both new WebPs: the A501 statistics and separate manual H501 cluster
example match the documented populations and settings. No integration blocker remains.
This review adds no application-suite, detailed native/Wasm parity, deployment, or
independent biological-validation evidence; the verification limits below still apply.

## Verification limits

New Rust unit checks, [test_morphology.mjs](../../../tests/test_morphology.mjs), and
[morphology.spec.ts](../../../tests/playwright/morphology.spec.ts) cover the new contract.
Writing a check does not mean it has run. Application suites are intentionally not run
for this refresh because the user handles application testing. Final static/build/capture
receipts are recorded in [VERIFICATION.md](../../VERIFICATION.md), including captures
completed at 2026-11-12T21:30:42.355Z and confirmation that the local server is stopped.

Earlier Python/native/Chromium parity covers the eight-value blob primitive, not the
new detailed schema, saved-analysis lifecycle, or browser presentation. No claim of improved
biological accuracy follows from shape measurements, source review, static checks, or
documentation captures. No watershed, machine learning, local rethresholding, boundary
splitting, or shape-based counting rule is introduced.

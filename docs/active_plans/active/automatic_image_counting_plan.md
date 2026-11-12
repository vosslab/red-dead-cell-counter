# Plan: Automatic image-specific cell counting

The authorized adaptive blob-processing experiment is tracked in
[adaptive_blob_processing_plan.md](adaptive_blob_processing_plan.md), with execution status in
[adaptive_blob_processing_progress.md](adaptive_blob_processing_progress.md). Its experimental
decision and final integration review are complete with no qualifying adaptive policy. The
report is [ADAPTIVE_BLOB_EXPERIMENT.md](../../ADAPTIVE_BLOB_EXPERIMENT.md). This broader
project plan remains open; the negative experiment does not deliver its automatic workflow.

## Context

Red Dead Cell Counter currently applies one manual DoG setting to every batch image. Its 15-100 run comparison exposes sensitivity, but the representative median run is not an accuracy criterion and must not select routine student counts.

The requested workflow is choose image(s), select **Analyze**, receive independently derived counts, inspect when wanted, and export CSV. Detection decisions must never depend on filename, `REFERENCE_COUNTS.csv`, or an expected count; filenames remain normal UI and CSV metadata. The eight human ImageJ totals have stated +/-10% uncertainty; they are calibration evidence, not held-out validation.

The fixed 10 px, k=4, 0.10000 detector has 12.5% calibration MAPE. Positive-DoG-pixel Otsu reached 8.1%, but undercounted H501 by 541 and A501 by 71. Neither result alone justifies an automatic replacement.

Thresholded blob area is evidence, not a count. The native real-image diagnostic uses 8-connected components in the unnormalized raw DoG response at 0.10000. Detector pick/blob totals are A101 398/339, A501 339/282, B301 294/240, C601 296/242, E401 546/414, F201 1,172/1,047, H1001 785/733, and H501 3,021/2,642. Median area is 124 px2 for one-pick blobs and 338 px2 for two-pick blobs; 25 multi-pick blobs are at or below the one-pick median.

The plan evaluates area jointly with peak count, cutoff persistence, roundness, and one binary moment proxy. These are threshold-dependent geometry cues, not biological truth or permanent hard filters. The current blob receipt reports 5,247 one-center and 691 multi-center blobs: median compactness 0.930/0.689 and median anisotropy 1.294/3.139 respectively. Only 7 multi-center blobs reach the single-center compactness median and 61 fall at or below its anisotropy median, so these descriptives do not yet establish incremental trigger value.

The supplied DoG Picker paper says maps are normalized but does not give a formula. Current [Appion DoG source](https://github.com/leginon-org/leginon/blob/myami-python3/appion/appionlib/apDog.py) is a separate candidate: `(D - mean(D)) / (4 * sd(D))`; its blob/peak path records area. This is not proof of the paper formula or a runtime dependency. Existing prior art separates thresholding from declumping: [CellProfiler](https://cellprofiler-manual.s3.amazonaws.com/CPmanual/IdentifyPrimaryObjects.html), [ACSAT](https://pmc.ncbi.nlm.nih.gov/articles/PMC6135987), and [Gudla et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC6320673).

## Objectives

- Establish a reproducible image-derived automatic method without a count oracle.
- Test image-specific scalar selection and spatial adaptation separately.
- Test blob area, peaks, persistence, roundness, and moment incrementally.
- Keep comparison and manual settings as advanced research tools.
- Export method/version and effective settings for every image.
- Complete honestly if no candidate wins, using a named fixed-baseline fallback.

## Design philosophy

This is an evidence-led technical redesign under **Use the scientific method** and **Keep it simple (KISS)**. Prefer a scalar per-image method when its evidence is competitive; a spatial or multi-scale method may ship directly when it earns the added complexity. The rejected alternative is implementing every plausible mechanism before real-image evidence shows it solves a measured problem.

## Scope

- Characterize images and thresholded DoG blobs from production-equivalent responses.
- Compare scalar, normalization, local re-threshold, multi-scale, and seeded-watershed arms.
- Choose at most one automatic method using a common evidence rule.
- Implement the selected method in Rust/Wasm with reproducible provenance.
- Make Single and Batch Analyze independent per-image automatic operations.
- Produce inspectable masks, centers, CSV rows, diagnostics, and release evidence.

## Non-goals

- Infer biological cell truth by dividing blob area by a constant.
- Let detection decisions depend on human totals, filenames, or calibration rows.
- Claim localization precision, recall, or segmentation IoU without annotations.
- Merge same-map threshold runs, whose centers are nested and whose union equals the lowest threshold.
- Add ML, a server, persistence, or a full batch-scale response cache.
- Require a person to label, tune, approve, or unblock a milestone.

## Current state summary

`rust/src/lib.rs` extracts red signal, computes matched DoG, selects 3x3 local maxima above a scalar cutoff, and applies strict half-diameter NMS. `PreparedImage` retains red signal plus only the latest `(diameter,k)` response; that bounded-memory contract must remain intact.

`main.ts` is 36-line event wiring. `counter_controller.ts` (436 lines) passes a shared `DetectorSettings` through a 102-line client and 53-line worker. `ImageResult` stores scalar settings and centers; the 253-line workspace exports scalar threshold and `dog-picker-1`. The 360-line viewer creates its DoG/Threshold views from scalar settings. A local field needs a different mask/provenance contract; it cannot lie in a scalar CSV column.

## Hypotheses

| ID | Hypothesis | Observable result | Failure response |
| --- | --- | --- | --- |
| H1 | Image-specific scalar selection improves the per-image profile. | Errors, locations, runtime. | Retain fixed scalar baseline. |
| H2 | Area plus peaks/persistence flags clumps. | Blob records and overlays. | Reject area trigger. |
| H3 | Roundness or moment adds evidence beyond area. | One-feature-at-a-time ablation. | Retain only measured benefit. |
| H4 | Local re-thresholding improves flagged clumps. | Split/merge audit. | Reject recursion. |
| H5 | Second scale helps apparent-size variation. | Metrics, memory, time. | Reject multi-scale pass. |
| H6 | Seeded watershed changes count decisions. | Seed/mask audit. | Reject boundary-only watershed. |
| H7 | Correction/normalization helps measured cause. | Before/after report. | Do not ship preprocessing. |
| H8 | Successful arms have a useful interaction. | One justified hybrid comparison. | Select the simpler arm. |

## Architecture boundaries and ownership

### Mapping (milestones -> components)

| Milestone | Component | Review boundary |
| --- | --- | --- |
| M1-M7 | Native diagnostics | Original pixels, raw DoG, no runtime oracle. |
| M8-M18 | Candidate evaluation | One variable per arm; common report. |
| M19-M20 | Algorithm/result decision | Architecture-agent assessment and provenance. |
| M21-M23 | Rust/Wasm/manual boundary | Typed result, memory, cancellation, parity. |
| M24-M26 | Student workflow/output | Primary action, advanced path, truthful views/CSV. |
| M27 | Closure | Evidence, build, docs, fallback release. |

### File scope

| File or directory | Intended change | Canonical source |
| --- | --- | --- |
| `devel/measure_blob_areas.py` | Components, area, equivalent diameter, peaks, persistence, roundness, moment. | Generates `generated/blob_area_experiment/` from the native Rust probe. |
| `devel/benchmark_automatic_methods.py` | Common candidate evaluator. | Ignored reports and overlays. |
| `rust/examples/threshold_probe.rs` | Exact response export only if diagnostics require it. | Rust core contract. |
| `rust/src/lib.rs`, `rust/src/prepared_image.rs` | Selected automatic core and compact metadata only. | Native tests/Wasm export. |
| `src/worker.ts`, `src/detector_client.ts` | Typed automatic request/reply. | Worker protocol. |
| `src/counter_controller.ts` | Manual/automatic routing and result persistence. | Workflow coordination. |
| `src/image_workspace.ts`, `src/image_viewer.ts` | Actual method provenance and masks. | Result/view contract. |
| `src/index.html`, `src/counter_elements.ts`, `src/workflow_modes.ts`, `src/main.ts`, `src/style.css` | Automatic primary action; manual Advanced settings. | Accessible UI contract. |
| `tests/playwright/`, Rust tests | Selected automatic behavior and manual regression. | Stable product contracts. |
| `docs/BLOB_AREA_EXPERIMENT.md`, `docs/AUTOMATIC_DETECTOR_EXPERIMENT.md`, `docs/WORKFLOW_MODES.md`, `docs/DESIGN_DECISIONS.md`, `docs/CHANGELOG.md`, `docs/VERIFICATION.md` | Evidence, decision, rollout. | Durable documentation. |

## Milestone plan

| M | Title | Summary | Goal |
| --- | --- | --- | --- |
| M1 | Freeze baseline | Record deployed outputs. | Comparable experiments. |
| M2 | Characterize images | Calculate image-only proxies. | Describe variation. |
| M3 | Measure blobs | Area, peaks, persistence. | Flag candidate clumps. |
| M4 | Measure roundness | Define compactness proxy. | Test shape information. |
| M5 | Measure moment | Define binary anisotropy proxy. | Test shape information. |
| M6 | Run ablation | Compare cue sets. | Keep only useful cues. |
| M7 | Build gallery | Render difficult crops. | Inspect failures. |
| M8 | Define evaluator | Common schema. | Prevent metric drift. |
| M9 | Prove isolation | Test name/order/reference independence. | Valid automatic claim. |
| M10 | Test scalar | Bounded image cutoffs. | Simplest candidate. |
| M11 | Test normalization | Appion-style standardization. | Isolate normalization. |
| M12 | Test background pass | One evidenced correction. | Avoid decorative filtering. |
| M13 | Test regional threshold map | Adaptive thresholds across sparse/dense regions. | Test spatial adaptation. |
| M14 | Validate regional map | Vary region scale and inspect seams. | Test map robustness. |
| M15 | Test recursive clumps | Re-threshold flagged overlapping blobs. | Test local declumping. |
| M16 | Test multi-scale | Add one bounded second scale. | Test size adaptation. |
| M17 | Test watershed | Use DoG seeds in flagged clumps. | Test seed-affecting splitting. |
| M18 | Test justified hybrid | Combine only complementary successful arms. | Test interaction. |
| M19 | Select or reject | Evidence decision. | Freeze compact contract. |
| M20 | Specify provenance | Scalar/local forms. | Reproducible output. |
| M21 | Implement native core | Selected detector. | Valid centers/metadata. |
| M22 | Extend Wasm | Transport result. | Preserve lifecycle. |
| M23 | Preserve manual | Advanced comparison intact. | Research safety. |
| M24 | Simplify Single | Automatic Analyze primary. | Student success. |
| M25 | Simplify Batch | Independent image analysis. | No tuning-image dependence. |
| M26 | Inspect output | Views, overlays, CSV agree. | Transparent results. |
| M27 | Close release | Verify and document. | Reviewable build. |

Every milestone has one owner role. The role owns its outcome and verification, while the manager coordinates dependencies.

The initial area/shape diagnostic is complete; full characterization, cutoff persistence,
conditional feature ablation, and algorithm comparisons remain planned. The manager assigns
one agent to each dispatched task. Parallel arms use separate experimental files and a common
frozen evaluator. A single integration owner lands shared controller, worker, and UI edits
sequentially; shared-file preparation and read-only reviews may run in parallel.

The reusable Rust/Wasm blob-measurement port was also completed during planning. Reuse
`rust/src/blob_features.rs` and its worker contract; this does not complete the later
automatic-detector selection or student workflow milestones.

| Milestone | Owner role |
| --- | --- |
| M1-M3 | Native diagnostic engineer |
| M4-M6 | Geometry diagnostic engineer |
| M7 | Visual evidence engineer |
| M8-M9 | Evaluation engineer |
| M10-M12 | Scalar-method researcher |
| M13 | Spatial-threshold researcher |
| M14 | Spatial-threshold verifier |
| M15 | Recursive-clump researcher |
| M16 | Multi-scale researcher |
| M17 | Watershed researcher |
| M18 | Hybrid-method researcher |
| M19 | Architecture agent |
| M20 | Interface-contract architect |
| M21 | Rust implementation engineer |
| M22 | Wasm boundary engineer |
| M23 | Regression engineer |
| M24-M25 | Interaction engineer |
| M26 | Result-presentation engineer |
| M27 | Release-verification engineer |

### Milestone: M1 Freeze baseline

- Depends on: None.
- Deliverables: Versioned fixed-detector counts, centers, input/output contract.
- Workstreams: Native detector characterization.
- Entry criteria: Eight images and current settings are readable.
- Exit criteria: Re-run reproduces output; receipt calls human totals evaluation-only.
- Parallel-plan ready: Yes; independent diagnostic work can start.

### Milestone: M2 Characterize images

- Depends on: M1 for shared red signal/dimensions.
- Deliverables: Background/noise, intensity distribution, diameter, density, and clump-fraction proxies.
- Workstreams: Native diagnostics.
- Entry criteria: Baseline response is available.
- Exit criteria: CSV/JSON uses pixels only, names units, calls every feature a proxy.
- Parallel-plan ready: Yes with M3.

### Milestone: M3 Measure blobs

- Depends on: M1.
- Deliverables: 8-connected raw unnormalized DoG components at diagnostic cutoffs; area, `sqrt(4A/pi)`, peaks, persistence.
- Workstreams: Native diagnostics.
- Entry criteria: Original-pixel response/centers exist.
- Exit criteria: Report distinguishes DoG mask area from raw-red footprint and rejects area-to-count conversion.
- Parallel-plan ready: Yes with M2.

### Milestone: M4 Measure roundness

- Depends on: M3.
- Deliverables: Explicit compactness `4*pi*A/P^2`, using a documented deterministic perimeter convention.
- Workstreams: Blob diagnostics.
- Entry criteria: Component boundaries can be measured.
- Exit criteria: Degenerate blobs and threshold dependence are recorded; roundness is not a hard cell filter.
- Parallel-plan ready: Yes with M5.

### Milestone: M5 Measure moment

- Depends on: M3.
- Deliverables: Binary covariance anisotropy `lambda_max/lambda_min` with an undefined result for degenerate components.
- Workstreams: Blob diagnostics.
- Entry criteria: Component pixels exist.
- Exit criteria: Formula, units, and invariances are documented. Do not port intensity-weighted Appion `_moment`, which is brightness dependent and has no current caller.
- Parallel-plan ready: Yes with M4.

### Milestone: M6 Run ablation

- Depends on: M3-M5.
- Deliverables: Area; area+roundness; area+moment; and all-feature clump-trigger comparisons.
- Workstreams: Shape-cue evaluation.
- Entry criteria: All cue records are present.
- Exit criteria: Retain only a cue with incremental measured benefit; no permanent threshold is adopted by assumption.
- Parallel-plan ready: Yes with M7-M8.

### Milestone: M7 Build hard gallery

- Depends on: M3-M6.
- Deliverables: Overlays for isolated, joined, saturated, and low-signal A501/F201/H501 regions.
- Workstreams: Visual diagnostic.
- Entry criteria: Blob/cue records exist.
- Exit criteria: Panels name crop coordinates, settings, mask, centers, and cues; conclusions remain qualitative.
- Parallel-plan ready: Yes with M8.

### Milestone: M8 Define evaluator

- Depends on: M1-M6.
- Deliverables: Common schema: count, signed/absolute error after detection, settings, method/version, runtime, location consistency, blob outcome.
- Workstreams: Evaluation harness.
- Entry criteria: Baseline/features exist.
- Exit criteria: Runtime inputs have no reference data; evaluation joins totals only afterward.
- Parallel-plan ready: Yes with M7.

### Milestone: M9 Prove oracle isolation

- Depends on: M8.
- Deliverables: Renamed-copy, altered-order, brightness, resize checks and runtime-source inspection receipt.
- Workstreams: Evaluation integrity.
- Entry criteria: Common result schema exists.
- Exit criteria: Normal checks pass; intentional reference injection fails.
- Parallel-plan ready: No; candidate arms depend on it.

### Milestone: M10 Test scalar selection

- Depends on: M9.
- Deliverables: Bounded image-specific scalar methods; k remains 4 unless a distinct k test earns change.
- Workstreams: Scalar arm.
- Entry criteria: Integrity check passes.
- Exit criteria: Common per-image report/overlay; comparison median never selects an answer.
- Parallel-plan ready: Yes with M11-M14.

### Milestone: M11 Test normalization

- Depends on: M9.
- Deliverables: Raw DoG baseline versus Appion-style full-map standardization.
- Workstreams: Normalization arm.
- Entry criteria: Exact response maps available.
- Exit criteria: Report states formula, zero-SD behavior, threshold rule, outcome, and source limit; source similarity is not validation.
- Parallel-plan ready: Yes with M10/M12-M14.

### Milestone: M12 Test background pass

- Depends on: M2 and M9.
- Deliverables: One correction only if M2 demonstrates a corresponding brightness/background condition.
- Workstreams: Preprocessing arm.
- Entry criteria: Measured condition exists.
- Exit criteria: Keep only if common evidence improves without a clear regression; otherwise remove scratch code and record rejection. If no corresponding condition exists, record this arm as not applicable, satisfying its dependency without an experiment.
- Parallel-plan ready: Yes with M10-M11/M13-M14.

### Milestone: M13 Test regional threshold map

- Depends on: M2 and M8-M9.
- Deliverables: A bounded regional threshold-map arm that derives local background/response statistics over regions tied to estimated diameter.
- Workstreams: Spatial adaptive arm.
- Entry criteria: Image-characterization proxy and common evaluator exist.
- Exit criteria: Report separately shows sparse and dense-region decisions, threshold-map range, location consistency, and actual mask. It rejects a field that only adds seams or noise.
- Parallel-plan ready: Yes with M10-M12 and M15-M17; M14 follows this result.

### Milestone: M14 Validate regional map

- Depends on: M13.
- Deliverables: Region-size and interpolation ablation for the one regional threshold algorithm.
- Workstreams: Spatial-threshold verification.
- Entry criteria: M13 produces an actual threshold map and mask.
- Exit criteria: The smallest robust region representation is selected, or the regional arm is rejected for seam/instability behavior.
- Parallel-plan ready: Yes with M10-M12 and M15-M17.

### Milestone: M15 Test recursive clumps

- Depends on: M3-M9.
- Deliverables: Recursive local re-thresholding only inside blobs flagged by area, peaks, persistence, and any M6 cue retained by ablation.
- Workstreams: Local declumping evaluation.
- Entry criteria: Blob/cue records and hard gallery exist.
- Exit criteria: The report separates isolated/clump changes, logs local recipe, and rejects unexplained splits.
- Parallel-plan ready: Yes with M10-M14 and M16-M17.

### Milestone: M16 Test multi-scale

- Depends on: M2, M8-M9.
- Deliverables: One second-scale arm with deterministic overlap reduction in original coordinates.
- Workstreams: Scale evaluation.
- Entry criteria: Diameter proxy supports the test.
- Exit criteria: Report includes uniqueness, locations, time, and peak-memory estimate; it proposes no all-scale cache.
- Parallel-plan ready: Yes with M10-M15 and M17.

### Milestone: M17 Test watershed

- Depends on: M3, M8-M9.
- Deliverables: DoG-seeded watershed restricted to flagged clumps and a seed-change audit.
- Workstreams: Watershed evaluation.
- Entry criteria: Clump masks and DoG seeds exist.
- Exit criteria: Report separates seed loss, over-split, merge, and boundary-only changes. Boundary-only watershed is rejected for counting.
- Parallel-plan ready: Yes with M10-M16.

### Milestone: M18 Test one justified hybrid

- Depends on: M10-M17.
- Deliverables: One combined pipeline only if two successful arms address distinct remaining failures; otherwise a not-applicable receipt.
- Workstreams: Method interaction evaluation.
- Entry criteria: Every individual arm has a result or documented rejection.
- Exit criteria: Compare the combination with each constituent using the common evaluator. Retain it only for incremental benefit; otherwise select the simpler constituent. This is a research comparison, not a runtime ensemble or method menu.
- Parallel-plan ready: No; the constituent evidence must exist first.

### Milestone: M19 Select or reject

- Depends on: M10-M17 and M18.
- Deliverables: One-sentence algorithm contract, retained/rejected record, negative-result fallback.
- Workstreams: Architecture assessment.
- Entry criteria: Common metrics and hard-gallery evidence for every arm.
- Exit criteria: Architecture agent accepts the simplest Pareto-competitive method with no clear correctness failure. If none qualifies, `fixed-dog-picker-1` ships as automatic fallback without adaptive claim.
- Parallel-plan ready: No; implementation needs the decision.

### Milestone: M20 Specify provenance

- Depends on: M19.
- Deliverables: `AutomaticResult` with method/version, effective diameter/k, scalar cutoff or tagged local strategy.
- Workstreams: Result contract.
- Entry criteria: Selected contract accepted.
- Exit criteria: Scalar stays scalar. Local stores deterministic recipe/version and summary range, never a misleading scalar or huge pixel map. A multi-scale winner records its scale recipe and any per-center scale needed to reproduce overlays.
- Parallel-plan ready: Yes with M21 planning.

### Milestone: M21 Implement native core

- Depends on: M19-M20.
- Deliverables: Deterministic selected Rust method and focused tests.
- Workstreams: Rust core.
- Entry criteria: Inputs, outputs, and invalid states documented.
- Exit criteria: Validated original-pixel centers/effective metadata return without reference reads.
- Parallel-plan ready: Yes with M24 preparation.

### Milestone: M22 Extend Wasm

- Depends on: M20-M21.
- Deliverables: Typed automatic worker reply/client method.
- Workstreams: Wasm boundary.
- Entry criteria: Native contract passes.
- Exit criteria: 40 MP validation, stale-reply protection, cancellation, freeing, and one-latest-response memory remain.
- Parallel-plan ready: Preparation for M23-M24 may run beside this work; protocol integration and parity follow this milestone.

### Milestone: M23 Preserve manual path

- Depends on: M22.
- Deliverables: Manual detector, preview, comparison, representative-median labeling remain Advanced.
- Workstreams: Regression boundary.
- Entry criteria: Automatic transport exists.
- Exit criteria: Manual native/Wasm parity and comparison browser flows pass except deliberate primary-action wording.
- Parallel-plan ready: Preparation for M24-M26 may run beside the regression assessment; integration follows its result.

### Milestone: M24 Simplify Single

- Depends on: M22-M23.
- Deliverables: Automatic Analyze primary; manual controls/comparison in Advanced settings.
- Workstreams: Student workflow.
- Entry criteria: Controller receives automatic provenance.
- Exit criteria: Student chooses one image, analyzes, sees count/method/overlay, and does not need a comparison.
- Parallel-plan ready: UI preparation can run beside M25-M26; shared controller edits land sequentially under one owner.

### Milestone: M25 Simplify Batch

- Depends on: M22-M23.
- Deliverables: Independent characterization/count per image and per-row provenance.
- Workstreams: Batch workflow.
- Entry criteria: Sequential automatic result exists.
- Exit criteria: No tuning image is required. A 96-file repeated-real-image stress run measures throughput, not 96 independent biology samples.
- Parallel-plan ready: Independent preparation can run beside M24/M26; shared controller edits land sequentially under one owner.

### Milestone: M26 Make output inspectable

- Depends on: M20 and M22-M25.
- Deliverables: Raw, DoG, actual mask, centers, CSV agree with applied method.
- Workstreams: Viewer/export.
- Entry criteria: Metadata supports method-faithful rendering.
- Exit criteria: Scalar masks use scalar cutoff; selected local methods render actual local mask; CSV is compact and reproducible.
- Parallel-plan ready: Yes with M27 preparation.

### Milestone: M27 Close release

- Depends on: M21-M26.
- Deliverables: Build, tests, receipt, decision, workflow docs, changelog, verification.
- Workstreams: Release evidence.
- Entry criteria: Selected or fallback path complete.
- Exit criteria: Artifacts regenerate, Pages build succeeds, calibration and independent-validation limits are distinct.
- Parallel-plan ready: No; it integrates behavior.

## Decision tree

1. Run M10-M17 with the common evaluator, inspect their galleries, and complete or explicitly skip M18 according to its entry evidence.
2. Reject nondeterminism, provenance/display mismatch, or measured false split/merge behavior that one bounded repair cannot resolve.
3. Prefer the simplest Pareto-competitive method: no broad per-image error regression, no unacceptable worst-image failure, stable locations under image-derived perturbations, and workable sequential runtime/memory.
4. Ship the selected winner. A spatial or multi-scale winner must have truthful provenance and actual-mask rendering through M20/M26; fix those contracts before delivery. If its correctness cannot be established, use the next qualifying simpler method or the named baseline fallback.
5. If no candidate qualifies, finish with named fixed baseline and preserve the report without adaptive-accuracy claim.

## Test and verification strategy

Permanent tests protect numeric validation, deterministic selected-method provenance, native/Wasm parity, truthful CSV, manual comparison preservation, automatic Single/Batch, cancellation, and actual-mask agreement. Existing manual Playwright workflows remain.

One-time diagnostics live in `tests/_temp/` or ignored `generated/`: all-eight reports, hard gallery, rename/order/brightness/resize probes, and 96-file throughput. Failure must select/reject a method or expose a concrete bug; otherwise it is advisory. Promote only intentionally stable behavior.

Totals support count error only. They cannot establish localization precision/recall or mask IoU. Hard-crop assessment is qualitative. Future independent annotations are valuable but not a completion dependency; leave-one-image-out on these eight is a stress diagnostic only.

## Migration and compatibility policy

Manual and automatically estimated scalar settings use the existing two-decimal diameter/k and five-decimal cutoff rounding before processing, with threshold >0.00001. A spatial recipe defines its raw-response units, quantization, and the same positive-cutoff constraint explicitly. Existing manual results retain settings and `dog-picker-1` provenance. Automatic results add explicit method/version and never silently rewrite manual results. Images stay browser-local; no storage migration or network change is needed.

The selected method preserves existing trust boundaries: exact RGBA length/dimensions, 40 MP cap, and finite validated settings before numerical work (ASVS 2.2.1/2.2.3); quoted CSV with formula protection (ASVS 1.2.10); sequential bounded per-image memory and cancellation responsiveness (ASVS 15.2.2). Reuse the current Rust/TypeScript stack first. If evidence requires a new dependency, verify its latest stable Cargo or npm release at execution rather than pinning an old version for this plan.

The current area/shape evidence and rerun command are in
[BLOB_AREA_EXPERIMENT.md](../../BLOB_AREA_EXPERIMENT.md). Reference Appion code remains
read-only under OTHER_REPOS/leginon and is not a build/runtime prerequisite. Preserve
the named baseline fallback as fixed sensitivity; do not describe it as image-specific
or spatially adaptive detection when all adaptive arms are rejected.

## Risk register

| Risk | Impact | Trigger | Owner | Mitigation |
| --- | --- | --- | --- | --- |
| Calibration overfit | False automatic claim | Mean improves but hard image regresses | Evaluation | Per-image profile/gallery; label calibration. |
| Area/shape overreach | Wrong clump counts | Cues conflict with peaks/persistence | Local arm | Cues only; reject direct count rules. |
| Local-preview mismatch | Uninspecttable count | Local mask exported as scalar | Result contract | Block shipment until actual mask renders. |
| Batch cost | Slow 96-image run | Full-image candidate sweep | Rust/Wasm | Bound candidates; sequential worker; measure. |
| Method drift | Irreproducible CSV | Versionless behavior | Result contract | Version recipe and test export. |
| Manual regression | Research workflow break | Comparison/cancel fails | Controller/UI | Preserve manual browser coverage. |

## Rollout and release checklist

- [ ] Obtain architecture-agent acceptance of M19's algorithm sentence.
- [ ] Build Pages with the repository production command.
- [ ] Run focused native, Node, browser contracts and manual flows.
- [ ] Exercise real-image automatic Single, heterogeneous Batch, cancellation, CSV, viewer states.
- [ ] Record calibration separately from independent-validation limits.
- [ ] Produce a locally verified Pages artifact; publishing is outside this plan and does not gate completion.

## Documentation close-out requirements

- Active plan / progress tracker: this document until M27.
- Experiments: `BLOB_AREA_EXPERIMENT.md` and `AUTOMATIC_DETECTOR_EXPERIMENT.md` include commands, boundaries, reports, rejected arms.
- Decision: record the selected automatic detector in `DESIGN_DECISIONS.md` after M19.
  The separately authorized Rust/Wasm mask-measurement primitive is already a settled decision.
- Workflow: update `WORKFLOW_MODES.md` after M24-M25.
- Release: update `CHANGELOG.md` and `VERIFICATION.md` with shipped behavior and limits.
- Archive: use `git mv` after M27; a human commits.

## Open questions and decisions needed

- Manager/subagent decision procedure:
  - Decision owner or dedicated class: architecture agent at M19.
  - Evidence and decision rule: common report, overlays, provenance feasibility, runtime/memory, and decision tree.
- Non-blocking follow-up: independent point/mask annotations improve future validation but do not block this plan.
- Non-blocking follow-up: skip M12 when M2 finds no measured background/brightness condition.

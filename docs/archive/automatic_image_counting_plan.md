# Plan: Beginner automatic image counting

## Context

The closed [adaptive blob processing plan](../active_plans/active/adaptive_blob_processing_plan.md) found no qualifying blob-refinement policy; its evidence and limits remain in [ADAPTIVE_BLOB_EXPERIMENT.md](../ADAPTIVE_BLOB_EXPERIMENT.md). The current interface and detector are built around manual tuning and a comparison workflow. This plan replaces the older automatic-counting proposal: image-derived threshold selection is now the required automatic feature, and a fixed detector is not its fallback.

The codebase already has a Rust `PreparedImage`, a worker that retains prepared pixels, browser-local image selection, a results workspace, an overlay viewer, and CSV export. The new workflow should reuse those boundaries and make one image's count inspectable before extending the same operation to a batch.

## Objectives

- Let a beginner choose example A501 or local image files, count one image or a batch, inspect each result, and export per-image results without first tuning detector controls.
- Select one deterministic image-derived method from three candidates using a real-corpus experiment and a declared rule; record method and review status with each result.
- Preserve manual detector selection and design-of-experiments comparison under Advanced for research use.
- Ship automatic counting with review flags when no candidate clearly improves on the baseline; do not substitute a fixed threshold method.

## Design philosophy

Use the simplest image-derived method supported by comparative evidence, with a visible result and review trail for uncertain counts. This applies **Scientific method**, **KISS**, and **Focus on important issues** from [docs/REPO_STYLE.md](../REPO_STYLE.md). A negative comparison does not cancel the requested feature: it ships provisionally with explicit review flags and inspectable output.

## Scope

- Model the first-run single-image task and evaluate it with cognitive walkthrough, guideline review, and browser checks.
- Reuse a shared native prepared-image response and probe path for candidate evaluation and production.
- Compare three per-image thresholds, then select one global method by the frozen rule below.
- Persist settings, selected method/version, and review reasons per image; preserve completed batch rows across later failures or cancellation.
- Replace the beginner-facing flow with image choice, a primary `Count cells` action, overlay inspection, and CSV export; move manual selection and DOE controls into Advanced.
- Verify native/Wasm parity, batch recovery, browser behavior, accessibility, and the documented build; record implementation evidence in the progress ledger.

## Non-goals

- Do not treat reference counts as runtime inputs or claim independent biological validation from this calibration corpus.
- Do not add a runtime method menu, ensemble, filename-specific rule, or fixed-threshold fallback.
- Do not redesign detector biology, retain the rejected adaptive blob policies, or change their closed experiment report.
- Do not claim student usability validation; the planned HCI evidence is inspection and browser checking only.
- Do not add image upload, server processing, or storage migration.

## Current state summary

The adaptive experiment has a documented accepted negative result; it does not leave an unresolved algorithm or implementation failure that requires stabilization. Existing Rust/Wasm and browser workflows provide reusable foundations, while the current visible workflow expects tuning. The prior automatic plan's fixed fallback and wide research sweep are superseded by this bounded comparison and required beginner workflow.

## Architecture boundaries and ownership

### Mapping (milestones -> components)

| Milestone | Component | Review boundary |
| --- | --- | --- |
| M1 | Beginner task model | Task completion, failure recovery, inspection-only HCI evidence |
| M2-M4 | Rust response, experiment, independent selector | Shared pixel response and frozen data-only selection |
| M5-M6 | Analysis contract and Rust detector | Per-image result provenance and native numeric behavior |
| M7-M8 | Worker/client and controller queue | Message contract, cancellation, row-level recovery |
| M9-M11 | Picker, guided UI, Advanced controls | Student-facing path and research boundary |
| M12-M14 | Workspace, CSV, persistence, parity | Applied settings agree across results, overlay, and export |
| M15-M16 | Browser stress and independent UX/accessibility review | Real browser behavior and responsive/accessibility evidence |
| M17-M18 | Documentation and integration | Reproducible handoff and repository build closure |

### File scope

| File or directory | Intended change | Canonical source, for generated output |
| --- | --- | --- |
| `rust/src/` and Rust tests | Shared prepared response/probe, candidate selection support, automatic per-image detector | Native implementation |
| `src/worker.ts`, `src/detector_client.ts` | Typed prepared-image response, automatic request/reply, cancellation behavior | Worker protocol |
| `src/counter_controller.ts`, `src/image_workspace.ts`, `src/image_viewer.ts` | Per-image queue/results, inspection, CSV provenance | Analysis contract |
| `src/index.html`, `src/style.css`, `src/workflow_modes.ts`, `src/main.ts` | Guided picker/example flow and Advanced manual controls | Task model and UI acceptance criteria |
| `tests/` | Focused native, protocol, browser, parity, and recovery checks justified by milestones | User-visible and numeric contracts |
| `docs/active_plans/active/automatic_image_counting_plan.md` and sibling progress ledger | Plan and evidence/status history | This plan |
| `docs/active_plans/reports/beginner_task_model.md` | Task model and inspection ledger | M1; implementation acceptance reference |
| `docs/WORKFLOW_MODES.md`, `docs/CHANGELOG.md`, `docs/VERIFICATION.md` | Final workflow, shipped behavior, and evidence | M17-M18; not rewritten before evidence exists |
| Browser screenshot artifacts | Refresh required workflow screenshots | Built UI and captured browser state |

## Candidate selector contract

Evaluate three image-derived global thresholds over the same frozen corpus and detector settings:

1. Otsu over a 256-bin histogram of positive finite DoG response values.
2. Li iterative thresholding over the same values, initialized at their mean, capped at 100 iterations, converging at half a histogram bin.
3. Three-class Otsu, using its lower split as the foreground threshold.

For every method, round the threshold to five decimal places, compare inclusively after converting to `f32`, and floor at `0.00002`. The baseline threshold is `0.10`; `0.12` is the sensitivity review. Select exactly one global method for all images by lexicographically minimizing: number of image references outside `[H/1.1, H/0.9]`, worst normalized distance outside that interval, mean normalized distance, then method simplicity. Here `H` is the reference count and detected counts are evaluated only after inference. Use a fixed documented simplicity ordering to break remaining ties. The 10% interval describes the neighboring threshold sensitivity comparison; it is not an accuracy confidence interval or a separate 10% regression gate.

Selection and runtime inference may use image pixels and image-derived values only. Filenames, references, reference counts, and human totals are unavailable to runtime selection. Freeze inputs and source before the reference join. If the selected method does not meet baseline quality classifications, ship it as provisional automatic counting and attach visible and CSV review flags; do not silently restore fixed-threshold inference. Record the `0.12` sensitivity comparison against the same `[H/1.1, H/0.9]` interval.

## User-facing contract

- Arrival offers `Choose images` and a secondary `Try example A501` action.
- `Try example A501` explicitly loads and counts the example through the automatic pipeline. Local file selection opens the workbench ready to count and does not count automatically.
- The application infers whether one or multiple images were selected. `Count cells` is the primary action for either scope.
- Each image has its own result, selected threshold, method/version, and review reasons. Inspect the detection overlay and export the same result to CSV.
- Manual detector choice and design-of-experiments controls live in `Advanced`; default threshold starts at `0.10`, and only the per-image threshold selector is automatic.
- Batch processing is sequential and continues after an individual image failure. Cancellation stops outstanding work. Completed rows remain visible; activating `Count cells` again recounts the selected set while retaining prior results until replaced.

## Milestone plan

| M | Title | Summary | Goal |
| --- | --- | --- | --- |
| M1 | Model beginner task | Define task, errors, recovery, and inspection criteria. | Clear guided flow |
| M2 | Share native response | Expose reusable prepared-image DoG response and threshold probe. | One numerical basis |
| M3 | Compare thresholds | Run frozen real-corpus candidate experiment. | Evidence for selection |
| M4 | Select independently | Recompute selection and integrity checks. | Trusted method decision |
| M5 | Define analysis record | Specify per-image settings, method/version, and review reasons. | Reproducible result |
| M6 | Implement Rust selector | Add selected per-image method and numeric validation. | Automatic native count |
| M7 | Connect worker/client | Transport automatic request and provenance. | Shared browser contract |
| M8 | Queue each image | Process sequentially with row-level recovery. | Safe batch behavior |
| M9 | Add image choice | Add local picker and A501 example entry. | First action is obvious |
| M10 | Build guided workbench | Count cells, inspect overlay, and export. | Beginner path complete |
| M11 | Move research controls | Put manual selection and DOE in Advanced. | Research capability retained |
| M12 | Save result details | Align result, overlay, and CSV provenance. | Inspectable outputs |
| M13 | Verify recovery | Check failed, canceled, and partial batch states. | Useful work survives errors |
| M14 | Verify parity | Compare native, Wasm, and recorded settings. | Consistent counts |
| M15 | Run browser stress | Exercise browser flows and 96 repeated real-image inputs. | Bounded operational evidence |
| M16 | Review interaction | Independent responsive and accessibility review. | HCI issues recorded |
| M17 | Refresh documentation | Update workflow docs and screenshots from the finished UI. | Accurate guidance |
| M18 | Close integration | Run required build/checks and publish evidence handoff. | Reviewable completion |

Milestones and one owner each are tracked in [automatic_image_counting_progress.md](automatic_image_counting_progress.md). Dependencies describe delivery order; an owner may finish checks without human research or approval gates.

### Milestone: M1 Model beginner task

- Depends on: None.
- Deliverables: [beginner_task_model.md](../active_plans/reports/beginner_task_model.md) with task steps, likely errors, recovery, acceptance criteria, and cognitive walkthrough/guideline ledger.
- Entry criteria: Existing picker, workbench, result viewer, and export have been inspected.
- Exit criteria: The single and batch flows have observable completion and recovery criteria; the evidence limits are explicit.
- Parallel-plan ready: Yes; task model informs UI work while native experiment work proceeds independently.

### Milestone: M2 Share native response

- Depends on: None; current prepared-image boundary is available.
- Deliverables: A native prepared-image response and probe reused by experiments and production.
- Entry criteria: Existing Rust response, dimensions, and validation contract are identified.
- Exit criteria: Same image/settings produce the same response for experiment and production; invalid dimensions and non-finite values are rejected at the boundary.
- Parallel-plan ready: Yes; independent from task model and corpus freeze.

### Milestone: M3 Compare thresholds

- Depends on: M2 for response implementation.
- Deliverables: Frozen inputs/source, per-image candidate outputs, overlays, sensitivity summary, and selector report.
- Entry criteria: Candidate formulas and baseline/sensitivity values in this plan are frozen; references remain withheld until inference outputs are saved.
- Exit criteria: All three methods and baseline are reported per image; `0.12` sensitivity is reviewed; outputs reproduce from the recorded command and manifest.
- Parallel-plan ready: No; frozen response and experiment input contract are prerequisites.

### Milestone: M4 Select independently

- Depends on: M3.
- Deliverables: Independent recomputation of candidate metrics, winner/tie break, and reference isolation.
- Entry criteria: M3 artifacts and frozen manifest exist.
- Exit criteria: Independent computation agrees exactly on method selection and review flags; rename/order and reference-injection checks support the runtime boundary.
- Parallel-plan ready: No; it verifies M3's completed evidence.

### Milestone: M5 Define analysis record

- Depends on: M1 for task/result needs; analysis-contract work can proceed in parallel with M2-M4, with selected method identity filled in when available.
- Deliverables: Shared per-image analysis record, version fields, and review-reason contract.
- Entry criteria: Required per-image provenance and review status are identified; final selector identity can be added later.
- Exit criteria: One record can reproduce the displayed count and CSV row; no reference or filename field is available to inference.
- Parallel-plan ready: Yes with UI preparation; implementation contract review precedes M6/M7.

### Milestone: M6 Implement Rust selector

- Depends on: M2 and M5.
- Deliverables: Validated per-image threshold computation, inclusive f32 cutoff, five-place rounding, and method provenance.
- Entry criteria: Native response and analysis record are accepted.
- Exit criteria: Selected method is deterministic on corpus and edge-case fixtures; provisional review conditions are returned, never replaced with fixed fallback.
- Parallel-plan ready: Yes with M7 protocol preparation.

### Milestone: M7 Connect worker/client

- Depends on: M5-M6.
- Deliverables: Typed worker/client automatic analysis response using the shared prepared image.
- Entry criteria: Analysis record and native method are stable.
- Exit criteria: Success/error/cancel responses preserve id and provenance, and previous prepared resources are released on replacement.
- Parallel-plan ready: Yes with M8 controller preparation; shared protocol lands before queue integration.

### Milestone: M8 Queue each image

- Depends on: M7.
- Deliverables: Sequential single/batch queue with independent per-image results and retained completed rows.
- Entry criteria: Automatic worker response is callable from the controller.
- Exit criteria: A per-image failure is recorded and processing continues for remaining images; cancellation stops outstanding work without clearing completed results. Activating `Count cells` again recounts the selected set while retaining prior completed results until replaced.
- Parallel-plan ready: No; it owns shared controller sequencing.

### Milestone: M9 Add image choice

- Depends on: M1 task model; can proceed while M2-M8 backend work runs.
- Deliverables: Arrival actions for `Choose images` and secondary `Try example A501`; local files use existing supported formats.
- Entry criteria: Existing asset and picker ownership are confirmed.
- Exit criteria: `Try example A501` loads the example and starts its automatic count through the same pipeline. Local file selection opens the workbench ready to count without automatic analysis; picker state communicates selection scope.
- Parallel-plan ready: Yes with backend work; isolate markup/style ownership where practical.

### Milestone: M10 Build guided workbench

- Depends on: M8-M9.
- Deliverables: Inferred single/batch scope, primary `Count cells`, per-image overlay inspection, and CSV action.
- Entry criteria: Queue and task model acceptance criteria exist.
- Exit criteria: One image and multiple images use the same primary action; result, busy, empty, failed, and partial states meet the task model.
- Parallel-plan ready: No; integrated workbench/controller changes share UI state.

### Milestone: M11 Move research controls

- Depends on: M10.
- Deliverables: Manual selected-image detector and DOE comparison under `Advanced`.
- Entry criteria: Guided automatic path works end to end.
- Exit criteria: Research controls remain usable without taking visual priority or changing automatic result provenance.
- Parallel-plan ready: Yes with M12 preparation; final shared UI integration is sequential.

### Milestone: M12 Save result details

- Depends on: M5, M8, and M10.
- Deliverables: Per-image method/version/settings/review reasons in results and CSV, plus overlay using the applied settings.
- Entry criteria: Result record and output columns are agreed.
- Exit criteria: A reviewer can reconcile displayed count, overlay, saved row, and selected method for every completed image.
- Parallel-plan ready: No; output contract spans workspace and analysis record.

### Milestone: M13 Verify recovery

- Depends on: M8 and M12.
- Deliverables: Browser checks for failure, cancellation, retry, and partial completion.
- Entry criteria: Per-image queue and result state exist.
- Exit criteria: Completed rows persist, no later image is mislabeled as complete, and the UI gives a clear next action.
- Parallel-plan ready: Yes; tests can be authored against the stable queue contract.

### Milestone: M14 Verify parity

- Depends on: M6-M7 and M12.
- Deliverables: Native/Wasm candidate and selected-method parity evidence.
- Entry criteria: Native and worker paths expose the same record.
- Exit criteria: Counts, threshold values, method/version, and review reasons agree within declared numeric representation.
- Parallel-plan ready: Yes with M13/M15 test preparation.

### Milestone: M15 Run browser stress

- Depends on: M10, M12-M14.
- Deliverables: Real browser single/batch checks and a 96-entry repeated-real-image stress receipt.
- Entry criteria: End-to-end path and output contract work.
- Exit criteria: No lost completed rows, stale responses, or resource accumulation that prevents completion; repeated inputs are labeled throughput evidence, not independent biological samples.
- Parallel-plan ready: No; integrated browser path must be stable.

### Milestone: M16 Review interaction

- Depends on: M10-M15.
- Deliverables: Independent responsive, keyboard, accessibility, and cognitive-walkthrough findings with resolved/reported issues.
- Entry criteria: Candidate UI is available in a built browser target.
- Exit criteria: Each critical task is walked from stated start to completion; findings map to task step and disposition. No student usability claim is made.
- Parallel-plan ready: Yes with M17 prep.

### Milestone: M17 Refresh documentation

- Depends on: M16 and stable behavior from M10-M15.
- Deliverables: Current workflow documentation and screenshots captured from the built interface.
- Entry criteria: Visible behavior and control labels are stable.
- Exit criteria: Docs and screenshots match single, batch, inspection, export, and Advanced states.
- Parallel-plan ready: Yes with final integration preparation.

### Milestone: M18 Close integration

- Depends on: M13-M17.
- Deliverables: Required build/check receipts, clean handoff, final plan ledger, and archival recommendation.
- Entry criteria: Feature and docs are integrated.
- Exit criteria: Required checks pass or failures have a precise disposition; plan/report links resolve; completed behavior and calibration limits are distinguished; independent integration review accepts the handoff.
- Parallel-plan ready: No; it integrates the final evidence.

## Test and verification strategy

Use focused native checks for each threshold formula, empty/constant/non-finite response, rounding, f32 inclusive comparison, and review flags. Freeze corpus and source hashes before joining references; compare candidate outputs per image and independently recompute the global choice. A renamed-copy and reordered-input audit checks image-only inference. References are joined only after saved detections.

Retain tests for numeric boundary behavior, method/version provenance, worker result integrity, completed-row preservation on error/cancel, CSV/overlay agreement, and browser single/batch task completion. The 96-entry real-image run is one-time throughput evidence. M16 uses a cognitive walkthrough, guideline-to-acceptance ledger, keyboard/browser accessibility checks, and responsive viewport review; these are inspection findings, not participant research.

For no clear improvement, continue to shipping only if the selected candidate remains deterministic and the visible review flag is present in result and CSV. A correctness failure, reference leakage, or inability to reproduce the selected method blocks shipment until corrected; it does not trigger a fixed fallback.

## Risk register

| Risk | Impact | Trigger | Owner | Mitigation |
| --- | --- | --- | --- | --- |
| Corpus overfit | Misleading automatic confidence | Candidate wins only on aggregate | Experiment/selector | Freeze per-image metrics, sensitivity review, provisional flags |
| Runtime/reference leakage | Invalid calibration | Reference or filename reaches inference | Experiment/contract | Freeze before join; rename/order and injection audit |
| Response mismatch | Experiment winner differs in production | Separate response paths drift | Native owner | One shared prepared-image response and probe |
| Batch partial loss | Useful results disappear | Later image fails or user cancels | Queue owner | Commit each completed row and keep it inspectable |
| Provenance drift | CSV or overlay misstates analysis | Display/export uses current controls | Analysis record owner | Store applied per-image record and compare outputs |
| HCI evidence overclaim | Inspection presented as student validation | Walkthrough/report language is vague | HCI reviewer | State reviewer coverage and no participant study |

## Rollout and release checklist

- [x] Freeze corpus/source manifest before any reference join.
- [x] Record selector result, sensitivity review, and independent recomputation.
- [x] Verify automatic Single and Batch flows, saved CSV, overlay, failure, cancellation, and retry.
- [x] Complete native/Wasm parity and responsive/accessibility walkthrough receipts.
- [x] Refresh workflow documentation and built-interface screenshots.
- [x] Run the repository build and required focused checks; hand off exact commands/results.

Publishing is outside this plan.

## Documentation close-out requirements

- Active plan and status: this plan and [automatic_image_counting_progress.md](automatic_image_counting_progress.md) through M18; independent closure is [automatic_integration_review.md](../active_plans/reports/automatic_integration_review.md).
- HCI evidence: [beginner_task_model.md](../active_plans/reports/beginner_task_model.md), updated with final walkthrough findings.
- Experiment evidence: report the frozen corpus, command, candidate metrics, overlays, decision, and limitations in the durable experiment record selected during M3.
- Workflow and release docs: update `docs/WORKFLOW_MODES.md`, `docs/CHANGELOG.md`, and `docs/VERIFICATION.md` after behavior is complete.
- Closeout: preserve experiment receipts and archive the active plan after accepted M18 evidence is recorded.

## Open questions and decisions needed

- The global binary Otsu selector and per-image record contract are settled and independently accepted; see the M3-M6 evidence above and M18 review.
- Non-blocking follow-up: independent biological annotations would strengthen validation, but are not a plan completion dependency.

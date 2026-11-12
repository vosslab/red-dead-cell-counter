# Progress: Beginner automatic image counting

The approved scope and milestone outcomes are in [automatic_image_counting_plan.md](automatic_image_counting_plan.md). The task and inspection model is [beginner_task_model.md](../active_plans/reports/beginner_task_model.md). This ledger records owner, state, dependency, evidence, and decisions. Status values are `Pending`, `Active`, `Done`, or `Blocked`; record a blocker only when work cannot proceed without an external change.

## Status

| M | Owner | Status | Depends on | Evidence / command |
| --- | --- | --- | --- | --- |
| M1 | Plan/HCI owner | Done | None | Task model, acceptance ledger, and inspection procedure drafted in `beginner_task_model.md`; no participant study claim. |
| M2 | `rust_threshold_experiment` | Done | None | Shared prepared-image response and threshold probe implemented; native tests recorded below. |
| M3 | `rust_threshold_experiment` | Done | M2 | Frozen eight-image comparison; automatic selector remains provisional because it misses baseline quality classifications. |
| M4 | Independent selector reviewer | Done | M3 | Independently selected binary Otsu; reference data remains outside runtime inference. |
| M5 | `analysis_contract` | Done | M1; may proceed alongside M2-M4 | Per-image analysis record and review-reason contract implemented. |
| M6 | Rust detector owner | Done | M2, M5 | Binary Otsu implemented in native Rust; current native test receipt below. |
| M7 | Worker/client owner | Done | M5, M6 | Wasm wrapper and worker/client result provenance implemented. |
| M8 | Queue/controller owner | Done | M7 | Sequential queue, saved CSV results, and per-image recovery behavior implemented. |
| M9 | `UI_shell` | Done | M1 | A501 example loads and starts automatic counting; local file selection opens a ready workbench without auto-counting. |
| M10 | UI/controller integration owner | Done | M8, M9 | Guided count, overlay inspection, CSV, and single/batch states implemented. |
| M11 | UI integration owner | Done | M10 | Manual detector and DOE controls remain under Advanced. |
| M12 | Analysis/output owner | Done | M5, M8, M10 | Result, overlay, and CSV use the saved per-image record. |
| M13 | Browser verification owner | Done | M8, M12 | Recovery browser regression passed; 17/17 workflows in 18.4 s. |
| M14 | Parity reviewer | Done | M6, M7, M12 | Eight real-image browser counts, centers, and cutoff values match native outputs. |
| M15 | Browser stress owner | Done | M10, M12-M14 | 96-image heterogeneous browser run completed 96 rows; counts and five-place cutoffs match native. Receipt below. |
| M16 | Independent HCI/accessibility reviewer | Done | M10-M15 | Final task/accessibility review accepts; nine Axe scans, responsive states, contrast, keyboard, recovery, CSV, and Advanced flow recorded below. |
| M17 | Documentation owner | Done | M16 | Five final post-CSS quality-90 WebP captures inspected; comparison 21/21, with summary statistics recorded below. |
| M18 | Integration owner | Done | M13-M17 | Final integration SPEC and QUALITY reviews accept. Five local links and ASCII passed; after plan archival, full pytest passed 1,155 checks and the test-discovery ordering regression passed. See [`automatic_integration_review.md`](../active_plans/reports/automatic_integration_review.md). |

## Decisions and evidence

| Question | Decision | Evidence / status |
| --- | --- | --- |
| What ships if candidate methods do not clearly improve? | Ship the selected image-derived method provisionally with visible and CSV review flags; never fall back to fixed threshold detection. | M3-M4 complete; binary Otsu misses the baseline quality classification and remains provisional. |
| Which threshold method ships? | One global binary Otsu method, selected by out-of-band reference count, worst normalized distance, mean normalized distance, then simplicity. | Independent review `automatic_threshold_selection_review` accepted; runtime receives no references, reference counts, or filenames. |
| Does image choice start analysis? | Local file selection opens the ready workbench; user starts analysis with `Count cells`. | A501 example explicitly loads and counts through the same automatic pipeline, with no additional count click. |
| Does the UI require a separate batch workflow or tuning image? | No. Infer single/batch scope and use per-image thresholding for each image. | M9-M17 implementation and browser/HCI acceptance complete; M18 review accepted. |
| How is HCI evidence described? | Cognitive walkthrough, guideline review, and browser/accessibility checks; no student usability claim. | `beginner_task_model.md`; complete evidence at M16. |

### Current implementation and experiment receipts

- The frozen comparison covers all eight real images. Automatic threshold selection uses global binary Otsu. Its quality class is **provisional** because its per-image classifications do not satisfy the baseline membership/mean/worst-distance criteria; a stronger fixed 0.12 result does not become a fallback.
- Automatic Otsu has 3/8 images outside `[H/1.1, H/0.9]`; the fixed 0.10 baseline has 4/8 outside and fixed 0.12 has 0/8. This is corpus-specific calibration evidence, not independent validation.
- Native Rust has 17 passing tests (15 unit and 2 integration). Native/Wasm boundary quality re-review accepts nine real-Wasm cases plus mocked-client cases. Built-browser parity matches all eight real-image center arrays and selected cutoffs: A101 326, A501 291, B301 238, C601 264, E401 480, F201 992, H1001 672, H501 2,456.
- Final canonical Pages build passed in 1.2 s at 14:13:50; log: `/private/tmp/automatic_pages_build_final.log`. Wasm is 57,536 raw / 25,643 gzip bytes, SHA-256 `a56984447184a7a2445e0b8eec7848a5855bf5b1fa35afff2d3925e71bfbdb59`; main JS is 35,894 bytes and worker JS 7,778 bytes. Native/Wasm boundary quality re-review accepts nine real-Wasm cases plus mocked-client cases. Both TypeScript, lint, formatting, and six DOE checks pass.
- Fresh full pytest passed 1,155 cases in 2.22 s (`automatic_rebuild_final`). The 141-case focused run also passed after the one-line import-boundary repair. The 17/17 browser regression passed in 18.4 s and checked all 5,719 center pairs. A heterogeneous stress run of the eight originals repeated twelve times completed all 96 rows; counts, actual five-place cutoffs, automatic/provisional method, and complete status match native results. Start-to-CSV took 70,812 ms; receipt: `/private/tmp/automatic_stress_final.log`, result JSON: `/private/tmp/automatic_stress_results.json`, CSV: `/private/tmp/automatic_stress_96.csv`. This is throughput evidence, not 96 independent samples. The first harness attempt exceeded Playwright's 50 MB input limit before the app ran; the corrected repeated-file-path harness passed.
- Final accessibility acceptance: nine Axe scans report zero violations across 12 states at widths 320, 480, 768, and 1920 with no overflow. Primary-button hover contrast is 5.1536:1, 5.4711:1, 5.5048:1, and 5.4336:1 at those widths. Keyboard, recovery, CSV, and 15-selection DOE workflows pass. A minor Advanced completion-focus issue is documented as non-blocking. The CSS-only correction is in READY3 (`/private/tmp/automatic_pages_build_release.log`; source CSS SHA-256 `efe2d1472201f3e366c277f4fc3031c50a00b20630196d44a2cc93cc1e87c6cd`); no JS/Wasm behavior changed.
- Final post-CSS captures are complete: all five quality-90 WebPs were inspected as clear and readable. The 21-run comparison completed 21/21 with mean 347.7, median 338.0, and population SD 95.2; A501 automatic count was 291 and marked provisional. Final dist manifest digest is `66078346ad7a563e51fae03f95d041951f5fcf01f0a5e0b30568c376ff93acb6` (`/private/tmp/automatic_dist_manifest_css733.log`). Independent integration acceptance found no blockers; five local links and ASCII compliance passed (`automatic_integration_review.md`).

## Handoff notes

- Keep this ledger and plan plus the M1 report current through implementation closeout.
- Keep experiment artifacts and commands in the durable M3 report; this ledger stores concise receipts and decision summaries.
- Record exact commands, outputs, reviewer role, and any rerun that supersedes earlier evidence as milestones complete.
- Invite implementation owners to challenge a milestone boundary or contract early; update the plan and decision table before dependent work proceeds.

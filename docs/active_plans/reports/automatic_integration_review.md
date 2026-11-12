# Automatic counting integration review

What this change does: beginners can choose local images, count each with an image-derived
threshold, inspect the detections, and export their saved results. The real A501 example uses
the same automatic pipeline. Manual counting and DOE comparison remain under Advanced.

## Verdict and scope

**SPEC ACCEPT. QUALITY ACCEPT. No integration blockers remain.** The reviewed implementation
matches the approved [automatic_image_counting_plan.md](../../archive/automatic_image_counting_plan.md).
The selected method remains provisional; acceptance establishes engineering behavior, not
biological accuracy. The manager can record this M18 review and finish the final documentation
freeze checks and ledger closeout.

Independent read-only review on 2026-11-12. Production source, tests, configuration, and Git
history were not changed by this reviewer; only this report was written. Repository rules,
the same-session rules receipt, Python/pytest rules for the experiment scripts, and the
Ponytail review guidance were applied. Python commands use `source source_me.sh && python3`.
A fragile pytest pins incidental structure or transient context instead of meaningful behavior.
This review applies **Scientific method**, **KISS**, **Reviews should simplify**, and
**Focus on important issues** from [REPO_STYLE.md](../../REPO_STYLE.md).

## Plan and architecture

| Milestones | Reviewed outcome |
| --- | --- |
| M1 | Beginner task model distinguishes local selection from the example shortcut, with explicit inspection, export, and recovery criteria. |
| M2-M4 | One prepared-image response supports the frozen three-method comparison and independent selection. Binary Otsu wins among automatic candidates; fixed 0.12 remains a comparison only. |
| M5-M7 | Typed saved analysis and four discriminated worker request/reply kinds preserve actual settings, method/version, reasons, and no-signal state. |
| M8-M11 | Sequential per-image counting, direct local picker, lazy real example, guided workbench, and selected-image Advanced research follow the task model. |
| M12-M14 | Saved centers and provenance drive the selected count, overlays, derived views, and CSV. Failed/cancelled recounts retain prior results with explicit attempt state. Native/browser parity agrees. |
| M15 | All 96 entries complete with correct per-image count, cutoff, status, and provisional metadata. Eight originals repeated twelve times establish throughput evidence. |
| M16 | Independent keyboard, recovery, responsive, contrast, and accessibility inspection accepts the final built interface. |
| M17 | Current workflow/architecture/usage docs and five refreshed WebP captures match automatic counting and Advanced research. |
| M18 | Build, regression, parity, stress, review, and artifact receipts support integration acceptance. Final ledger and documentation checks remain the manager's closeout task. |

No architectural drift was found. Rust owns numerical behavior; the worker owns the prepared
image; the client transports typed requests; the controller coordinates work; workspace/viewer
modules present saved results. The change removes mode synchronization instead of introducing a
new framework or compatibility layer. Existing entry points, decoding, detector primitives,
preview, CSV, and DOE machinery are reused. No dependency was added for this feature.

The production request contains pixels and scalar settings, with no filename, reference total,
expected count, or calibration lookup. Production automatic inference selects binary Otsu for
every image and adjusts only its threshold. Diameter/k remain editable Advanced settings with
10/4 defaults. The rejected adaptive-blob experiment remains a documented negative result and
is not installed as a runtime policy.

## Findings and dispositions

No must-fix or should-fix finding remains in the reviewed scope.

- The earlier worker cache issue is repaired: replacement requests free and clear the previous
  prepared image before validation, so invalid replacement pixels cannot expose stale detections.
  The fresh browser parity regression verifies the failure and subsequent reuse behavior.
- The comparison message collision is repaired: the client copies diameter/k/threshold explicitly,
  preventing DOE design-point `kind` from replacing protocol `kind`. Real selected-image DOE,
  the normal regression, and the final 21-successful-run capture pass.
- Queued recounts retain their previous saved count while reporting queued/working/cancelled/failed
  attempt states. Recovery tests and independent walkthrough CSVs distinguish these states.
- The maintenance benchmark uses the new picker/workbench/Advanced route. Blob verification
  already sends the explicit `blobs` request kind. Screenshot capture now rejects failed
  comparisons instead of accepting a table filled only with failures.
- The task model, plan, progress decisions, changelog, and comparison-feedback introduction were
  reconciled with current behavior. Earlier comparison inspection scenarios are explicitly historical.
- The 320 px primary-hover contrast failure is corrected and remeasured at every target width.
  This is a CSS-only correction; final captures use the rebuilt stylesheet.

The retained tests protect numerical boundaries, worker ownership, saved provenance, partial
recovery, and user-visible flows. The one-time stress proof was removed after its receipts were
preserved. Adding another parallel test framework or repeating the heavy experiment is unnecessary.

## Evidence checked

| Check | Receipt and result |
| --- | --- |
| Native Rust | 17 tests pass: 15 unit and 2 integration. Cargo check, fmt, and Clippy pass; reviewed native acceptance remains applicable. |
| Repository checks | Full pytest passes 1,155 cases. TypeScript checks, ESLint, Prettier, and six DOE tests pass. |
| Canonical build | `WASM_PACK_CACHE=/Users/vosslab/.cache/wasm-pack ./build_github_pages.sh` succeeds; final CSS build log is `/private/tmp/automatic_pages_build_release.log`. |
| Browser regression | Fresh one-worker Chromium run passes all 17 tests in 18.4 seconds; `/private/tmp/automatic_browser_suite_final.log` supersedes the initial 7-failure receipt. |
| Independent parity audit | Parsed the eight-image attachment in `/private/tmp/automatic_browser_results.json` and compared it with frozen native predictions. All 5,719 center pairs match exactly; cutoffs match after `Math.fround`, and method/version/reasons/no-signal agree. |
| 96-entry stress | `/private/tmp/automatic_stress_final.log`, `automatic_stress_results.json`, and `automatic_stress_96.csv` show 96 completed rows in 70,812 ms from Count to CSV. The earlier Playwright buffer-limit failure occurred before application input and is superseded. |
| Experiment integrity | Independently recomputed all eight manifest source hashes, all eight original JPEG hashes, and the saved predictions digest. All match. Bundled A501 is byte-identical to the original. |
| Interaction | [beginner_usability_review.md](beginner_usability_review.md) accepts the final build: 12 layout states without page overflow, nine final axe scans with zero violations, keyboard/recovery/export/selected-DOE checks pass. |
| Contrast | Final actual primary-hover ratios at 320/480/768/1920 px are 5.1536/5.4711/5.5048/5.4336 to one. |
| Documentation captures | All five quality-90 WebPs were independently inspected after the CSS rebuild. This reviewer also directly viewed the final counter and comparison captures: A501 291, cutoff 0.26860, provisional notice, visible markers; comparison 21 successes/0 failures and mean 347.7, median 338.0, SD 95.2. |

The source hash audit checks the current native implementation against the frozen experiment;
it does not substitute a new benchmark run. The parity cutoff comparison accounts for native
JSON decimal printing versus JavaScript's exact representation of the returned `f32` value.
Five-decimal CSV cutoffs agree with those saved numeric values.

## Reviewed artifact

The final ten-file dist manifest is `/private/tmp/automatic_dist_manifest_css733.log`, with
digest `66078346ad7a563e51fae03f95d041951f5fcf01f0a5e0b30568c376ff93acb6`.

| Asset | Raw bytes | Gzip bytes | SHA-256 |
| --- | ---: | ---: | --- |
| Wasm | 57,536 | 25,643 | `a56984447184a7a2445e0b8eec7848a5855bf5b1fa35afff2d3925e71bfbdb59` |
| Main JS | 35,894 | 11,616 | `fbfe0a63e3c5d2b1202a3158364806631bd5e8a75b91358ec98d4069614326ec` |
| Worker JS | 7,778 | 2,819 | `013085b8cf2f0a92c2f1b9ffacea6f4eac37d2b5c28c798d7887af415733e7c6` |

Final stylesheet SHA-256:
`efe2d1472201f3e366c277f4fc3031c50a00b20630196d44a2cc93cc1e87c6cd`.
The final CSS-only rebuild preserves the tested JavaScript and Wasm hashes.

## Handoff and limits

Record M18 acceptance and run the normal final checks after the documentation freeze. Preserve
the experiment, browser, interaction, and capture receipts, and recommend archiving the completed
plan using the repository's required Git move when Git writes are authorized. A human commits.
Publishing remains outside this plan; this review does not verify a live Pages deployment.

Eight uncertain ImageJ totals are calibration references, not independent biological labels.
All automatic results remain provisional: binary Otsu leaves 3/8 outside the reference interval,
fixed 0.10 leaves 4/8, and fixed 0.12 leaves none. Aggregate improvement over 0.10 does not establish
new-image accuracy, localization validity, or superiority to fixed 0.12. The runtime correctly
avoids a fixed fallback. See [AUTOMATIC_DETECTOR_EXPERIMENT.md](../../AUTOMATIC_DETECTOR_EXPERIMENT.md)
and [automatic_threshold_selection_review.md](automatic_threshold_selection_review.md).

The HCI evidence is expert inspection and browser behavior, not a student study. The accepted
minor Advanced focus limitation is documented in the interaction report; it does not block the
beginner workflow. No new recovery mechanism or extra research capability is required for it.

Verdict: Ship the reviewed integration through the authorized local handoff.
Not checked: a fresh full experiment rerun, native screen-reader users, real touch hardware,
Safari/Firefox, independent biological annotations, student performance, or live publication.
Risk: calibration bias remains; inspect detections before using a biological count.

# Progress: Adaptive blob processing experiment

The approved scope and completion rules are in
[adaptive_blob_processing_plan.md](adaptive_blob_processing_plan.md). The durable result is
[ADAPTIVE_BLOB_EXPERIMENT.md](../../ADAPTIVE_BLOB_EXPERIMENT.md). This ledger records owners,
status, dependencies, decisions, reviews, commands, and residual risks.

## Status

M1-M13 are complete. Every candidate fails the frozen retention rule, including L's 0.12
sensitivity regression. Independent assessments accept the negative result. M14-M17 are N/A
under the approved no-winner branch; there is no selected policy to port or expose. M18 has
passing regression/performance evidence and completed documentation. The fresh
`adaptive_integration_review` accepts final integration with no blockers. The broader
[automatic_image_counting_plan.md](automatic_image_counting_plan.md)
remains open. Keeping this local plan and ledger discoverable does not require an index change.

| M | Owner | Status | Depends on | Receipt / exact command |
| --- | --- | --- | --- | --- |
| M1 | Experiment manager | Complete | None | Final manifest freezes eight input and nine source hashes before the reference join; all match after the run. |
| M2 | Geometry engineer | Complete | M1 | Per-image/base-cutoff one-pick median A0 and frozen bounds saved in 144 cases. |
| M3 | Local-threshold engineer | Complete | M2 | Large-parent refinement and persistence checked; fresh specification and quality reviews accept. |
| M4 | Small-blob engineer | Complete | M2 | Unique ownership includes zero-pick parents; growth and two-valid-cutoff rejection checked. |
| M5 | Shape engineer | Complete | M3 | Upward triggers and child criteria implemented; no direct shape rejection. |
| M6 | Evaluation engineer | Complete | M1 | Interval loss and frozen retention rule checked; retained regression covers inclusive bounds. |
| M7 | Experiment runner | Complete | M3-M6 | `source source_me.sh && python3 devel/benchmark_adaptive_blobs.py` exits 0; 48 default cases in the final 144-case run. |
| M8 | Compactness assessor | Complete: reject | M7 | `compactness_effect_assessment` rejects LSC/LS; only one previously out-of-band image improves and default/0.08 loss worsens. |
| M9 | Inertia assessor | Complete: reject | M7 | `inertia_effect_assessment` rejects LSI/LS on the same gates. |
| M10 | Interaction assessor | Complete: reject | M7 | `adaptive_selection_assessment` rejects LSCI/LSC; zero previously out-of-band images improve. |
| M11 | Robustness engineer | Complete | M7 | Same benchmark exits 0 with 96 nearby plus 48 default cases; D5 correction rerun changes zero saved outputs. |
| M12 | Visual engineer | Complete | M7 | 106,944 parent CSV rows and 46 WebPs generated; `adaptive_gallery_assessment` inspects eight actual panels, confirms lost lobes and unresolved hard regions. |
| M13 | Independent reviewer | Complete: no winner | M8-M12 | `adaptive_selection_assessment` recomputes case counts/CSV/references and every gate; separate direct recomputation agrees. |
| M14 | Rust engineer | N/A: no winner | M13 | M13 rejects every overall candidate/P; no adaptive port is warranted. |
| M15 | Contract architect | N/A: no winner | M13 | No selected adaptive method or result recipe to add. |
| M16 | Wasm engineer | N/A: no winner | M14-M15 | No adaptive policy or recipe to transport. Existing geometry primitive remains available. |
| M17 | Interface engineer | N/A: no winner | M16 | No adaptive mask or CSV/UI change to expose. |
| M18 | Verification engineer | Complete | M17 | Final integration accepted by `adaptive_integration_review` with no blockers. Audit covers all 144 cases, 106,944 parent rows, 46 gallery assets, nine source and eight input hashes, exact curated H501 image, and independent gate computations rejecting every policy. Latest full pytest: 1,115 passed in 1.93 seconds. Reviewer did not rerun the benchmark, browser workflows, Pages build, or native checks; prior scoped receipts remain authoritative. |

## Decisions

| ID | Decision | Propagated to |
| --- | --- | --- |
| D1 | Freeze eight inputs and source hashes before joining reference counts. Compute A0 per image/base cutoff and freeze across policies/local cutoffs. Six policies at three cutoffs give 144 rows: 48 default plus 96 nearby. | Plan, M1, M7, M11, final report |
| D2 | Filenames, references, and human counts do not enter inference; join references only after detection. | Prototype API, runner, scoring, rename/order audit |
| D3 | If M13 finds no qualifying policy, M14-M17 are N/A and M18 closes with the negative result. | M14-M18; no adaptive production changes |
| D4 | Process small parents first and exclude them from shape-driven upward refinement. Lower global components must contain exactly one original parent, including zero-pick parents. Growth reaches [Amin,Amax] and may extend beyond the parent. Reject persistent smallness only with two distinct valid lower cutoffs; otherwise grow if plausible or preserve P and its cutoff floor. Never reprocess a selected upper cutoff. | Plan, prototype, focused implementation proof |
| D5 | Round diameter/k to two decimals and compare scores with `numpy.float32(cutoff)`. Correct the runner's 0.08/0.12 boundary comparison, rerun all 144 cases, and retain the demonstrated regression check. The rerun changes zero experiment outputs. | Plan, runner, final source freeze, retained regression |
| D6 | Retain the current detector and 0.10 default after every adaptive policy fails. Shape measurements remain research evidence, without a shipping acceptance filter or biological accuracy claim. | Final report, design decisions, changelog; broader plan remains open |

## Review receipts

- `adaptive_spec_review` accepts core/scoring but identifies P3: the runner compares 0.08/0.12
  against Python float thresholds rather than float32 thresholds.
- `adaptive_cutoff_boundary_fix` corrects P3, passes its focused regression, and reruns all
  144 cases. Experiment outputs are unchanged. The final manifest supersedes first-run hashes.
- `adaptive_spec_rereview` accepts the final specification: all nine source and eight input
  hashes match, with 16 focused implementation proofs passing.
- `adaptive_quality_review` accepts quality: focused proofs pass; saved centers and CSV account
  for all 144 cases, with no duplicate centers.
- `compactness_effect_assessment`, `inertia_effect_assessment`, and
  `adaptive_selection_assessment` independently reject compactness, inertia, and joint/overall
  selection. Their rejection is an accepted negative experiment outcome, not a failed review.
- `adaptive_gallery_assessment` inspects eight saved WebPs. H501 crop 02 loses visible lobes'
  markers/mask coverage; known hard H501/A501/F201 clumps remain unresolved. Local biological
  labels are unavailable, so the visual assessment is qualitative.
- `adaptive_integration_review` accepts M18 with no blockers after auditing all 144 cases,
  106,944 parent rows, 46 gallery assets, nine source and eight input hashes, the exact curated
  H501 image, and independent gate computations rejecting every policy. It did not rerun the
  benchmark, browser workflows, Pages build, or native checks; scoped receipts remain in effect.
- The independent audit checks 144 case files and 106,944 CSV rows. A renamed real A101 image
  reproduces the native baseline and all policies; copied pixels and reversed center/policy
  order reproduce decisions, masks, and centers. Receipt: ignored
  `generated/adaptive_blob_experiment/verification.json`.

## Commands and measurements

These are completed manager/verification-agent receipts reviewed by `adaptive_integration_review`:

| Command | Result |
| --- | --- |
| `source source_me.sh && python3 devel/benchmark_adaptive_blobs.py` | Exit 0, all 144 cases; all eight P/default arrays exactly match native Rust. |
| `source source_me.sh && python3 -m pytest tests/ -q` | 1,115 passed in 1.93 seconds after temporary-check cleanup. |
| `source source_me.sh && python3 -m pytest tests/test_pyflakes_code_lint.py -q` | 50 passed. |
| `./check_codebase.sh` | TypeScript type/lint/format and six DOE checks pass. |
| `cargo test --manifest-path rust/Cargo.toml` | 12 Rust tests pass. |
| `WASM_PACK_CACHE=/Users/vosslab/.cache/wasm-pack ./build_github_pages.sh` | Pages-ready build passes. |

The focused browser command passes five checks in 9.2 seconds:

```sh
source source_me.sh && PLAYWRIGHT_BROWSERS_PATH=/Users/vosslab/.cache/ms-playwright PW_PORT=4189 npx playwright test --workers=1 --grep 'all supplied images|researcher can count|prepared worker image|production worker measures|viewer tabs retain'
```

This covers all eight real images through the browser worker, real CSV, prepared-image state,
blob measurements, and actual Raw/DoG/Threshold views. It is a focused run; the historical full
21-workflow receipt belongs to the earlier geometry-port work.

The documentation gate command
`source source_me.sh && python3 -m pytest tests/test_markdown_links.py tests/test_ascii_compliance.py tests/test_source_file_line_limit.py -q`
passes 340 checks after the report/record edits. `git diff --check` is clean; `cmp` confirms
the preserved H501 WebP is byte-identical to the generated crop.

The first full pytest run has 1,126 passes and two executable-mode failures in existing blob
verifiers. Restoring executable modes to `devel/verify_blob_features.py` and
`tests/playwright/verify_blob_features.mjs` resolves those failures; 171 shebang/executable checks
pass. The final retained suite has 1,115 passes. Two permanent checks remain in
`tests/test_adaptive_blob_contracts.py` (float32 boundary and uncertainty loss); three ignored
temporary files containing 16 one-time proofs are removed after those checks pass.

Final canonical elapsed time is 38.55 seconds. High-water RSS is about 1.24 GB for Python
and 364.53 MB for children (decimal units), measured separately. Cached per-policy
timings depend on order and cannot establish a relative speed ranking. Artifacts total about
25 MB and remain ignored; the durable report preserves one byte-identical quality-90 crop.

The first 38.97-second run is historical and superseded by the D5-corrected canonical run.
No adaptive detector, mask transport, result recipe, CSV, or interface change ships.

Residual risks: eight uncertain manual totals are calibration evidence; count agreement does
not establish localization accuracy or mask quality. Lost visible lobes demonstrate a plausible
failure mechanism, without proving a local biological count. Area/shape cues may not transfer
to other images. These limits support rejecting the tested policies and do not block closure.

# Plan: Adaptive blob processing experiment

## Completion status

The experiment completes with a negative engineering outcome: no adaptive policy passes the
frozen retention rule. M1-M13 are complete; conditional M14-M17 are N/A. M18 is complete:
`adaptive_integration_review` accepts the report and verification records with no blockers.
The durable evidence is
[ADAPTIVE_BLOB_EXPERIMENT.md](../../ADAPTIVE_BLOB_EXPERIMENT.md), with receipts in
[adaptive_blob_processing_progress.md](adaptive_blob_processing_progress.md). The broader
[automatic_image_counting_plan.md](automatic_image_counting_plan.md) remains open.

## Purpose

This approved experiment tests local threshold refinement for unusually large DoG blobs using
the eight real calibration images. It measures whether area flags, threshold persistence,
compactness, or inertia improve counts relative to the current detector. Human reference counts
are used only after inference to score results. They are uncertain calibration targets, not
ground truth or confidence intervals.

This is one authorized workstream under the broader
[automatic_image_counting_plan.md](automatic_image_counting_plan.md). It has no human approval gates.

## Frozen inputs and baseline

- Use the eight real images and their ImageJ manual counts as references.
- Treat each reference H as uncertain within 10 percent: score against [H / 1.1, H / 0.9].
- Use detector settings d=10, k=4, threshold=0.1 as the baseline.
- Compute A0 as each image's median 8-connected DoG blob area among blobs with one current pick,
  separately at each base cutoff (0.08, 0.10, and 0.12). Freeze each A0 across policies and all
  local threshold searches at that base cutoff.
- Freeze large-area bounds at 0.5*A0 and 2*A0. Empty reference sets preserve baseline picks and
  report insufficient size evidence.
- Round diameter d and k to two decimal places. Round thresholds to five decimal places, then
  compare kept scores with `numpy.float32(cutoff)`. Require a finite cutoff greater than 0.00001.
- Detection code must not read filenames, reference inputs, or reference counts. Join references
  only after all detections have finished.
- Reuse one DoG response per image across all six policies.

## Processing rules

### Large blobs

For a blob with area greater than Amax=2*A0, inspect thresholds in ascending order at 1.25, 1.5,
2, 3, then 4 times the baseline cutoff. Search only within the original parent mask. Select the
lowest threshold whose child components each have area in [Amin, Amax] and, when the relevant
shape policy is enabled, have compactness C >= 0.8 and finite inertia I <= 2. At the next threshold,
require one-to-one containment and the same child count. Check area only at the first candidate
level. A 4x result validates the 3x result; it is not self-confirming. Process small-blob decisions
first and exclude those parents from shape-driven upward refinement. After selecting an upper
cutoff, do not reprocess that parent or oscillate its threshold.

Accept either one child (consolidation) or multiple children. Place each child pick at its
strongest response pixel, breaking ties in row-major order, and replace the original parent picks.
If no level qualifies, retain the original picks and report the unresolved blob explicitly.

### Small blobs

For a blob with area below Amin=0.5*A0, inspect distinct valid cutoffs in descending order below
the baseline, beginning at 0.75x then 0.5x. A lower level's global connected component must contain
exactly one original parent, including parents with zero picks. A recovered component must have
area in [Amin, Amax]; it may extend beyond the original parent mask. Retain the parent's pick count
and grow its mask. Reject a parent as persistently small only when at least two valid lower levels
uniquely own it and remain below Amin. If fewer than two distinct valid lower levels exist, do not
reject it as persistently small: grow using an available valid level if plausible, otherwise
preserve the P result and its threshold floor. If ownership is ambiguous or area overshoots, preserve
the original result.

### Shape cues

Compactness below 0.8 or finite inertia above 2 triggers the normal upward area inspection; shape
does not directly reject a blob. Area, persistence, compactness, and inertia remain experiment
cues, not biological truth.

## Policies and evaluation

Evaluate six nested policies: P (current picks), L (large-area refinement), LS (L plus small-area
refinement), LSC (LS plus compactness), LSI (LS plus inertia), and LSCI (LS plus either shape cue).
Run each policy on all eight images at base cutoffs 0.08, 0.10, and 0.12, for 144
policy-image-cutoff results. Reuse one DoG response per image and cutoff-specific A0 across all
policies and local cutoffs. The nearby-condition set contains 48 default results plus 96 nearby
results, 144 total.

For estimate C and uncertain reference interval [L,U], define loss as
`max(L-C, 0, C-U) / H`. Report mean loss, worst loss, and number of estimates inside the interval.
Keep a candidate over its comparison only when mean loss is strictly lower, at least two
out-of-band images improve, no in-band image moves out, worst loss does not worsen, and mean
loss does not worsen at either sensitivity threshold. Ties favor fewer mechanisms; negate a
benefit that is indistinguishable.

Compare L against P, LS against L, each shape policy against LS, LSCI against the better
individual shape policy, and the final selected policy against P. Test 96 nearby results in addition
to the 48 default results, for 144 total. Galleries include the all-parents decision CSV, image
panels for known hard regions, and the three largest positive and three largest negative count
changes per image. They support qualitative review and are not ground truth.

## Milestones

Each milestone has one owner, a concrete outcome, and an executable check. Owners coordinate
reviews through the manager; no human decision is required to proceed.

| M | Owner | Depends on | Outcome and executable check |
| --- | --- | --- | --- |
| M1 | Experiment manager | None | Freeze inputs, rules, and baseline. Run a manifest/rules check that confirms eight inputs, reference isolation, and baseline settings. |
| M2 | Geometry engineer | M1 | Estimate A0 per image and base cutoff. Run a report check for one-pick median areas, frozen values, and empty-reference handling. |
| M3 | Local-threshold engineer | M2 | Implement large-blob threshold search inside the parent mask. Check child-area bounds, containment, same-count, tie-break, and unresolved-parent cases. |
| M4 | Small-blob engineer | M2 | Implement lower-threshold ownership/recovery. Check unique ownership, zero-pick parents, area-range growth beyond the parent mask, ambiguous ownership, and overshoot. |
| M5 | Shape engineer | M3 | Add compactness/inertia trigger gates. Run checks proving shape triggers upward inspection and never directly rejects. |
| M6 | Evaluation engineer | M1 | Implement interval loss and candidate rule. Run boundary, in-band, sensitivity, and strict-improvement checks. |
| M7 | Experiment runner | M3-M6 | Produce default-cutoff results for all six policies and eight images. Check 48 policy-image-cutoff rows and one response per image and cutoff. |
| M8 | Compactness assessor | M7 | Compare LSC with LS. Run the frozen selection-rule report. |
| M9 | Inertia assessor | M7 | Compare LSI with LS. Run the frozen selection-rule report. |
| M10 | Interaction assessor | M7 | Compare LSCI with the best individual shape policy. Run the frozen selection-rule report. |
| M11 | Robustness engineer | M7 | Add 96 nearby-cutoff results to M7's 48 default results. Check 144 total rows and cutoff rounding. |
| M12 | Visual engineer | M7 | Produce the all-parents decision CSV and panels for hard regions and three largest positive and negative count changes per image. Check the image manifest and outputs. |
| M13 | Independent reviewer | M8-M12 | Select the simplest qualifying policy or document no winner. Run an independent recomputation of selection metrics from saved rows. |
| M14 | Rust engineer | M13 | Conditionally port the selected policy to Rust. If no policy qualifies, record N/A and the no-winner receipt. Otherwise run native parity against the canonical experiment results. |
| M15 | Contract architect | M13 | Conditionally define the result recipe. If no policy qualifies, record N/A. Otherwise run a schema check for method, version, settings, and local recipe. |
| M16 | Wasm engineer | M14-M15 | Conditionally transport the selected policy and recipe through Wasm. If no policy qualifies, record N/A. Otherwise run native/Wasm parity. |
| M17 | Interface engineer | M16 | Conditionally show the actual mask and CSV for one batch. If no policy qualifies, record N/A. Otherwise run a single-batch viewer/CSV agreement check. |
| M18 | Verification engineer | M17 | Run regression, performance, and documentation checks. If M14-M17 are N/A, verify the existing app is unchanged and close with the negative result. |

## Implementation boundaries

- `devel/adaptive_blob_analysis.py` prepares the response and exposes
  `PreparedBlobs.analyze`, returning centers, mask, decisions, reference area, and area bounds.
- `devel/adaptive_blob_scoring.py` owns the shared evaluation metrics and selection rule.
- `benchmark_adaptive_blobs.py` and `adaptive_blob_gallery.py` own experiment execution and
  ignored generated outputs.
- Do not add an ML model, server, plugin, framework, filename-based branch, or reference-count
  input to inference.
- If selected, port only the selected policy. The canonical result method/version/settings/local
  recipe drives both viewer and CSV. Update internal contracts directly without a legacy adapter.

## Execution notes

The prototype agent owns `devel/adaptive_blob_analysis.py`; the scoring agent owns
`devel/adaptive_blob_scoring.py`; the experiment-runner agent owns `benchmark_adaptive_blobs.py`,
`adaptive_blob_gallery.py`, and ignored generated outputs. Use Luna for documentation and scoring,
and Sol for core processing and experiment execution. The manager coordinates fresh specification,
quality, and integration reviews for delegated changes.

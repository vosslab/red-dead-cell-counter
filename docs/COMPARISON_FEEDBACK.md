# Comparison feedback inspection

The current interface separates Single image tuning/inspection from Batch processing
and CSV export. [WORKFLOW_MODES.md](WORKFLOW_MODES.md) records the latest task model,
handoffs, state-preservation rules, and acceptance checks. The sections below preserve
the evidence and rationale from earlier inspection passes.

## Task and evidence scope

Researchers compare detector settings on one microscopy image, decide which count and
settings to trust, then apply those settings to a plate-sized batch. The consequence of
unclear feedback is abandoning a running comparison or unknowingly batching with the
wrong settings. The interface is used on desktop and phone browsers.

Method: cognitive walkthrough and guideline inspection of the existing application,
followed by browser behavior checks. This is an agent inspection, not a participant study
or a measurement of researchers' confidence or comprehension.

## Baseline findings

- A global changing status and growing table provide little sense of time remaining.
- The highlighted row does not explain why its count was recommended.
- The relationship between recommended settings, manually applied settings, and the next
  batch requires remembering which button was pressed.

## Task model and acceptance ledger

| Task step | Information needed | Guideline and acceptance criterion |
| --- | --- | --- |
| Start comparison | Has work started, and for which image? | Visibility of system status: show preparation immediately and identify the image. |
| Wait | Which settings are running; how much is left? | Recognition over recall: show completed/total, a labeled progress element, current parameters, elapsed time, and an approximate remaining time after enough completed runs. |
| Interpret results | How different are counts, and why this recommendation? | Explain the decision: summarize successful/failed runs, count range, mean, median, and population SD. Explain the representative median run and distinguish it from an accuracy claim. |
| Apply result | Which settings and count are now in use? | WCAG 1.4.1: use explicit Applied/Recommended text as well as visual highlighting. Confirm which settings the next batch will use. |
| Cancel or encounter failure | What finished; can I recover? | Error recovery: retain completed rows, report partial completion and failures honestly, and never display a cancelled or failed run as fully completed. |
| Receive updates accessibly | Can updates be perceived without moving focus? | WCAG 4.1.3: use polite live feedback and a labeled progress control; do not move keyboard focus to announce progress. |

Sources: [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
and [W3C use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).

## Verification scenarios

1. Start a real-image comparison; inspect preparation, current parameters, advancing
   progress, and timing. Complete all settings and inspect the count-spread summary.
2. Identify Recommended and Applied without relying on color. Apply another row by
   keyboard and verify the active settings and batch CSV agree.
3. Cancel after partial completion; retain completed rows and report the actual completed
   fraction. A decode failure must show an actionable error without false completion.
4. Inspect desktop and phone rendering, accessible names/live-region attributes, keyboard
   focus, and text contrast. Automated checks establish conformance evidence only for the
   inspected states; no screen-reader user study is implied.

Implementation owner: UI/UX engineering (`src/main.ts`, `src/index.html`, `src/style.css`).
No detector, scoring, or dependency changes are required.

## Workbench workflow inspection

The subsequent header-only refinement removes the workbench eyebrow and reduces title,
skull, padding, and border sizes. This keeps the full name while bringing the viewer
about 100 pixels higher at 1440 pixels wide. Six responsive renders, the entry/count/CSV
checks, and a populated-counter accessibility scan passed; measurements are recorded in
[VERIFICATION.md](VERIFICATION.md#compact-workbench-header).

The later UI/UX pass used the same researcher scenario: enter the saloon, choose images,
compare one, inspect its applied picks, analyze all selected images, and download CSV.
Two independent agent inspections informed implementation and checked the result. There
were no participant sessions; scores below are expert judgments about this task, not
measured user performance. Desktop is the main research setting; narrow browser views
must remain usable.

Before implementation, the acceptance measures were: identify the current image and its
count without consulting the ledger; distinguish applied settings from edited controls;
return from comparison to inspection in one action; preserve the batch/CSV behavior;
provide keyboard selection; and avoid page overflow at 320, 480, 768, and 1920 pixels.

| Task step | Observed friction | Implemented acceptance check |
| --- | --- | --- |
| Choose images | Four analysis actions were enabled before any image existed. | Actions remain disabled until file selection; the visible Images stage names the selected file count. |
| Tune | A flat toolbar gave single-image and batch actions similar emphasis. | Numbered groups place Compare settings in Tune and inspect, followed by Count and export. |
| Inspect | Filename and count were only in the separate ledger. | Viewer heading shows filename, count, dimensions, and actual applied settings; edited controls produce an explicit stale-control cue. |
| Select another image | Focusable table rows acted as custom buttons. | Native filename buttons expose the current image and retain keyboard focus after selection. |
| Interpret comparison | Statistics appeared in prose and at the bottom of a long table. | Mean, median, and population SD also appear in three short highlights; values match the table footer. |
| Apply and continue | Returning to the viewer required navigating back through the page. | Inspect applied detections scrolls to and focuses the current image heading. Applied feedback names the next batch action and scope. |
| Finish batch | Individual rows lacked an overall completion summary. | The ledger reports counted, waiting, and failed totals while retaining per-image results and CSV. |

The grouping follows [W3C information and relationships](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html).
Existing live status messages remain available without moving focus, following
[W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).
Inspection and analysis controls use a 44-pixel minimum target, following the enhanced
[W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html).

Heuristic scores use 0 = critical issue, 4 = no identified issue in the inspected task.

| Heuristic | Before | After | Evidence or remaining limit |
| --- | --- | --- | --- |
| Visibility of status | 2 | 4 | Selected count/context and counted/waiting/failed ledger summary. |
| Match with researcher vocabulary | 3 | 3 | Scientific labels retained; technical ranges available in a disclosure. |
| User control | 3 | 3 | Cancellation, per-run Apply, and manual analysis retained. |
| Consistency | 3 | 4 | Native buttons replace custom keyboard table-row behavior. |
| Error prevention | 2 | 3 | No-image actions disabled; numeric validation retained. |
| Recognition over recall | 2 | 4 | Filename and applied settings stay with the viewed count. |
| Efficiency | 3 | 4 | One-action return from comparison to inspection. |
| Minimalist presentation | 2 | 3 | Smaller masthead, grouped controls, and collapsed technical ranges; full results remain long. |
| Error recovery | 3 | 3 | Existing error/cancel coverage passes; image context includes a retry cue. |
| Help and guidance | 3 | 3 | Stage names and local instructions replace the repeated step list. |

Observed validation:

- All 17 Chromium checks passed, including all eight originals, comparison and batch CSV,
  cancellation, 100 runs, preview tabs, zoom, and the new keyboard workflow. After the
  final CSS changes, all four affected workflow/viewer checks passed again.
- Type checking, lint, formatting, and six experiment-design checks passed. The focused
  repository documentation/source checks passed 285 cases.
- At 1440 x 1000, the masthead shrank from 314 to 182 pixels and the viewer started at
  y=558 rather than y=729, while retaining 44-pixel controls.
- Axe-core 4.14.0 reported zero violations with the requested WCAG A/AA tags in both
  the baseline empty/selected states and the final empty/selected/completed states.
  This is inspected-state automated evidence, not full accessibility certification.
- Final renders had no page overflow at all four target widths, including a long
  filename at 320 pixels. Keyboard selection and return-to-inspection focus passed.
  Additional 900/1024-pixel checks exposed control-strip overflow; moving the control
  groups into one column below 1100 pixels fixed it. Final 900/1024/1100/1280 checks
  all matched the viewport width.
  The hovered ledger button retained dark text on paper rather than inheriting the
  generic dark button background. No browser JavaScript errors occurred.
- Screenshots and raw scan/layout evidence are in
  `/private/tmp/red-cell-experiment/ux_before/` and `ux_after/`; updated overview and
  comparison WebP images are in `docs/screenshots/`.

The 96-image stress run, other browser engines, screen-reader participant testing, and
the deployed Pages revision were not rechecked in this pass. Detector calculations
were unchanged by this UI work.

## Pick inspection and zoom

A further user report identified insufficient zoom for inspecting individual picks. The
previous limit was twice the fitted image width; for a 4250-pixel image in a 750-pixel
panel, that is only about 0.35 displayed pixels per original pixel. Increase the zoom
range and provide Actual pixels and Fit image actions. The zoom readout must distinguish
fit percentage from original-pixel magnification. Verification: actual-pixel view displays
one CSS pixel per image pixel; high zoom exceeds that scale, and Fit image restores a
bounded overview without expanding the page horizontally.

Click-and-drag panning extends the same inspection task without another mode or
toolbar. The image follows the mouse or pen while the left button is held, including
outside the viewport through pointer capture. Release, lost capture, cancellation,
window blur, and file replacement end the drag. Grab/grabbing cursors and a short
navigation hint explain the interaction. The viewport remains keyboard-focusable;
scrollbars and native touch gestures remain available. A focused real-image-crop
browser check verifies pan direction, pointer capture, release/blur recovery, retained
position across image tabs, and keyboard scrolling. Physical touch hardware was not
tested.

## Count statistics

The user also requested mean, median, and standard deviation of the Counts. The long
summary includes all successful candidates, including zero counts, and excludes failed
runs. Standard deviation is the population standard deviation across those candidate
counts (divide by N), since the summary describes the complete tested grid. Partial
cancellation labels the successful subset explicitly. These are descriptive measures of
parameter sensitivity; they do not replace the count associated with the selected overlay.
Verification independently calculates all three statistics from the table's Count column.

## Observed results

- The 11-test Chromium regression passed in 15.7 seconds. It includes recommendation/apply
  behavior, independent mean/median/population-SD calculations from the table, partial
  cancellation, all eight originals, and actual-pixel/deep-zoom/fit behavior.
- The full A501 comparison completed 27 successful settings in about 18 seconds: counts
  232 to 410, mean 334.3, median 338.0, population SD 47.4.
- Desktop and phone renders were captured; close inspection of A501's saturated touching
  object confirmed that 6400% fit reached approximately 11.5 displayed pixels per image
  pixel at the desktop viewport.
- Axe-core 4.14.0 found one scrollable-region focus issue on the completed comparison.
  The image viewport now has keyboard focus, an accessible region name, and a visible
  focus style. A final selected-image scan reported zero violations for the requested
  WCAG A/AA rule tags. This is automated evidence for inspected states, not full WCAG
  certification or a screen-reader participant study.
- Temporary captures and scan reports are under `/private/tmp/red-cell-experiment/`,
  including `comparison-feedback.png`, `feedback-zoom.png`, and
  `feedback-accessibility-final.json`.

## DoE update

The 27-point grid and its axis-line stability explanation above describe the previous
version. Comparison now starts with a 15-point log-space central composite design,
augmented to 21 runs by default and up to 100 on request. Feedback
identifies factorial/axial/center runs, reports the actual design center and parameter
ranges, and explains which evaluated median-count run is applied. Statistics remain
descriptive across the tested settings. See [experimental design](EXPERIMENT_DESIGN.md).

## First-use workflow and readable results

The next inspection follows a new researcher's first session: enter the saloon,
choose images, compare settings, inspect picks and summary counts, then analyze a
batch and export CSV. The user's screenshot exposed excessive numeric precision,
unformatted large counts, missing table statistics, and a secondary visual treatment
for the recommended first action.

| Task step | Guideline | Acceptance criterion |
| --- | --- | --- |
| Find the first action | Recognition over recall and visual hierarchy | Compare settings follows image selection and is the primary button; a short visible sequence explains comparison, inspection, and batching. |
| Choose experiment length | User control and visible system status | Default 21 runs; accept whole-number budgets 15 through 100, show the actual total, and retain cancellation. |
| Read a row | Match displayed precision to the task | Diameter and k use two decimals, thresholds five, and counts use thousands separators. Actual processing and CSV use the same rounded settings. |
| Compare counts | Reduce memory demands | Mean, median, and population SD appear in the Count column of the table footer as well as the long summary; failures are excluded and partial results are labeled. |
| Enter a tiny cutoff | Prevent invalid inputs | Reject threshold <=0.00001; five-decimal rounding makes 0.00002 the smallest supported setting. |

The method remains a cognitive walkthrough with browser checks, not a participant
usability study. Implementation belongs to the UI/UX worker; the experimental-design
worker owns run selection and rounding. Browser verification checks the complete
image-to-comparison-to-CSV handoff and a 100-run real-image crop.

Observed outcome: all 14 Chromium workflows passed, including the 100-run real-image
crop and numerical agreement between applied values and CSV. Full-resolution H501
produced a visible footer with mean 3,060.4, median 3,021.0, and SD 872.6 over 21 runs.
The final completed-comparison axe scan found no requested A/AA violations. Gold-label
contrast on the recommended row was repaired from 3.97:1 to 5.52:1. Desktop and mobile
inspection found no page overflow after correcting the loaded-image panel's minimum size.

## Inspecting the processing stages

Raw, DoG, and Threshold tabs expose the same selected image with shared zoom and
marker controls. The caption gives the applied diameter, k, and cutoff for derived
views. Counted images keep their stored settings; changing controls prepares a new
analysis without relabeling an existing result. A new selection starts on Raw.

Arrow keys move focus between tabs; Enter or Space activates the focused tab.
Activation is manual because the first derived image requires worker processing.
Loading feedback stays beside the viewer, and stale work is cancelled when switching
sources or returning to Raw. The binary mask uses the original DoG values rather
than the contrast-stretched display. Browser checks verify these transitions and
native/Wasm pixel-plane parity. This remains agent inspection and automated evidence.

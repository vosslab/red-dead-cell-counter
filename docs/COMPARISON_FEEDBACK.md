# Comparison feedback inspection

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

## Pick inspection and zoom

A further user report identified insufficient zoom for inspecting individual picks. The
previous limit was twice the fitted image width; for a 4250-pixel image in a 750-pixel
panel, that is only about 0.35 displayed pixels per original pixel. Increase the zoom
range and provide Actual pixels and Fit image actions. The zoom readout must distinguish
fit percentage from original-pixel magnification. Verification: actual-pixel view displays
one CSS pixel per image pixel; high zoom exceeds that scale, and Fit image restores a
bounded overview without expanding the page horizontally.

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

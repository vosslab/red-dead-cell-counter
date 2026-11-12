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
| Interpret results | How different are counts, and why this recommendation? | Explain the decision: summarize successful/failed runs, count range, and count ranges along each parameter axis around the recommendation. State that stability is not accuracy. |
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

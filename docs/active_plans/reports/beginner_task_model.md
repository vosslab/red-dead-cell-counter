# Beginner task model: Count cells

## Decision and evidence scope

Decision: can a beginner move from opening the tool to inspecting and saving an automatic count without first choosing detector parameters?

Use a goal-action task model and a cognitive walkthrough. Review labels, recognition cues, feedback, error recovery, keyboard access, and responsive layout in the browser. This is an expert inspection plan; it does not claim student testing or learner validation.

## User and setting

- User: a beginner who wants a useful count, not a lesson in detector tuning.
- Context: local browser session with one image or a set of images; files remain on the user's device.
- Goal: count cells, inspect where detections landed, and retain the result.
- Main consequence of error: an uninspected or uncertain count may be treated as reliable.

## Single-image task

| Step | User goal and action | Needed cue or response | Likely error | Recovery and completion evidence |
| --- | --- | --- | --- | --- |
| 1. Start | Choose local images or try example A501. | Two clear entry actions; example is secondary. | Unsure whether an example changes local files. | Explain that the example opens the workbench and starts its automatic count; local files remain local. |
| 2. Select | Choose one local image. | Workbench opens and identifies the selected image. | Expects file selection to start counting. | Show the ready state; the next explicit `Count cells` action starts analysis. |
| 3. Count | Activate `Count cells`, or wait for the A501 example's automatic count. | Busy state and clear completion/error status. | Repeats action or assumes the interface froze. | Disable duplicate action while working; show progress/finished state and retry when failed. |
| 4. Inspect | Review count and detection overlay. | Count is prominent; overlay shows detected centers on the image. | Treats a provisional/flagged result as confirmed. | Show review reason beside count and include it in exported record. |
| 5. Save | Download CSV. | Clear export action after a result exists. | Exports before completion or cannot identify the row. | Disable until a row exists; include filename, count, method/version, settings, and review reasons. |

Completion: the user can identify the selected image, count, inspect the overlay, recognize any review flag, and download a CSV row that agrees with the visible result.

## Batch task

| Step | User goal and action | Needed cue or response | Likely error | Recovery and completion evidence |
| --- | --- | --- | --- | --- |
| 1. Select | Choose several local images. | UI infers batch scope and lists selected rows. | Assumes a representative tuning image is required. | No tuning-image step; each image receives its own automatic threshold. |
| 2. Count | Activate the same `Count cells` action. | Sequential status identifies current, completed, failed, and waiting rows. | One image fails and user assumes all results were lost or processing stopped. | Record the failed row and continue through remaining images; cancellation stops outstanding work and keeps completed rows. Activating `Count cells` again recounts the selected set while prior completed results remain until replaced. |
| 3. Inspect | Select any completed row and review its overlay/details. | Per-image count, applied settings, method/version, and flags. | Reads another row's settings as current. | Bind viewer and details to selected row. |
| 4. Save | Download CSV. | One row per image, including incomplete/failure state. | CSV omits the distinction between failed and not yet run. | Encode status and error/review reason explicitly. |

Completion: the user can distinguish completed, flagged, failed, and waiting images; inspect a chosen completed result; export completed results without losing rows after a later failure or cancellation.

## Interaction acceptance ledger

| Task step | User need | Guideline | Acceptance check | Evidence |
| --- | --- | --- | --- | --- |
| Start | Recognize the first action | Recognition over recall; use plain labels | `Choose images` is primary; `Try example A501` is visible secondary action | Browser walkthrough |
| Select | Know what selection did | Visibility of system status | Local file choice opens the workbench ready to count. `Try example A501` explicitly loads and counts A501 through the same automatic pipeline, with no additional count click. | Browser walkthrough |
| Count | Know when work starts/ends | Feedback for system status | Busy/completed/error state is visible and announced through status semantics | Browser and accessibility tree |
| Inspect | Understand result provenance | Match system state to user expectations | Displayed count and flags belong to selected image and its saved analysis record | Overlay/record comparison |
| Save | Predict the exported result | Error prevention and consistency | CSV row reproduces visible image, count, method/version, settings, and review status | CSV inspection |
| Batch recovery | Recover from partial failure | Support recognition and recovery | Per-image failures are recorded while processing continues; cancellation stops outstanding work; completed rows remain visible until replaced by a new result | Failure/cancel walkthrough |
| All steps | Operate without pointer dependence | Keyboard access and visible focus | Critical path has logical focus order, visible focus, usable activation, and accessible names/states | Keyboard and accessibility checks |

## Walkthrough procedure

1. Begin from a fresh page, activate `Try example A501`, and verify it loads and counts without another action.
2. Repeat with one local image; verify selection opens the workbench but does not auto-run.
3. Select multiple images, count, inspect a non-first row, and export.
4. Exercise one failed image and cancellation after at least one completion; verify processing continues after the failed row, cancellation preserves completed rows, and a new `Count cells` action recounts the selected set.
5. Repeat critical actions using keyboard; review focus, status announcements, accessible names, and a narrow responsive viewport.
6. Record task step, expected cue, observed response, severity, correction/owner, and retest evidence. Resolve critical completion/recovery issues before M18 or document a precise disposition.

## Evidence limits

The walkthrough and guideline ledger establish whether the implementation follows this task model. Browser checks establish behavior only for exercised states. No representative student participants are recruited, so this artifact cannot establish student success, comprehension, speed, or preference. The real-image reference corpus evaluates detector behavior separately and cannot establish that the interface teaches or validates a biological count.

## Final inspection receipt

The independent final review accepted the guided workflow. Nine Axe scans found zero
violations across 12 states at widths 320, 480, 768, and 1920 pixels; no page overflow
occurred. Primary-button hover contrast measured 5.1536:1, 5.4711:1, 5.5048:1, and
5.4336:1 at those widths. Keyboard, recovery, CSV, and the 15-selection Advanced DOE
workflow passed. A minor focus placement after Advanced completion is documented as
non-blocking. These are browser and expert-inspection findings, not participant
usability evidence.

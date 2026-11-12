# Single-image and batch workflows

## Task and method

Researchers tune a detector on one image, inspect the actual picks, and apply those
settings to a collection of images. The previous toolbar exposed both analysis scopes
at once. A first-time user had to infer whether an action would process one image or
replace counts across the entire selected set.

Method: task analysis and an independent agent cognitive walkthrough, followed by
browser behavior and accessibility checks. This is expert inspection, not participant
evidence about confidence, speed, or comprehension.

## Mode contract

| Mode | File selection | Main actions | Results |
| --- | --- | --- | --- |
| Single image (default) | Choose one image, or inspect the image selected in Batch. | Compare settings; Analyze selected image; inspect Raw/DoG/Threshold and picks. | Prominent count, full comparison runs, and Use settings for batch. |
| Batch | Choose one or more images and select a ledger row for tuning. | Analyze images with current settings; Compare, then analyze batch; Tune selected image. | All file counts, processing feedback, and Download CSV. |

Switching modes preserves files, the selected image, settings, counts, and comparison
results. It does not run the detector. Choosing a new file set replaces the selection,
as before. Both modes use the same detector settings and viewer; there are no separate
settings stores to synchronize.

Use settings for batch opens Batch with the current values. Tune selected image returns
to Single image for that ledger row. CSV always exports the complete selected file set,
including waiting/error rows and the settings actually used for each completed image.
Batch export also works with one file.

Mode changes and handoffs are disabled during processing. Cancel remains available in
both modes. Automatic batch comparison keeps its progress, summary, and applied settings
visible in Batch; the detailed run table is available in Single image.

## Walkthrough and acceptance ledger

| Scenario | User need | Observable completion check |
| --- | --- | --- |
| First-time entry | Understand which task is active. | Single image is selected and exposes no batch processing or export actions. The picker accepts one file. |
| Tune and hand off | Carry an inspected result into the batch. | Compare a real image, inspect the chosen run, and use the handoff; the same rounded controls, file, and count survive. |
| Count a collection | Apply one set of values to every file. | Batch shows all files; completed counts and exported per-image settings agree. |
| Automatic batch | Work without a manual tuning step. | Comparison progress remains visible, then all selected files are processed and exported. |
| Retune one file | Avoid overwriting the other results. | Select a ledger row, open Single image, and analyze it; other file counts and settings remain intact. |
| Switch or recover | Preserve work and avoid overlapping runs. | Idle switching preserves results; active switching is disabled; cancel preserves finished rows. |
| Keyboard operation | Know and change the active mode. | Native grouped radios expose checked state and support arrow keys; explicit handoffs focus the destination mode. |

The mode selector uses a native fieldset and legend, following
[W3C grouping guidance](https://www.w3.org/WAI/tutorials/forms/grouping/).
Changing modes changes the visible controls without submitting data or processing files,
consistent with [W3C on-input guidance](https://www.w3.org/WAI/WCAG22/Understanding/on-input.html).
Processing feedback retains the existing
[status-message behavior](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).

Implementation: `src/workflow_modes.ts`, `src/index.html`, `src/style.css`, and the existing
processing calls in `src/main.ts`. Verification results and evidence locations are in
[VERIFICATION.md](VERIFICATION.md). Browser scenarios live in
[counter.spec.ts](../tests/playwright/counter.spec.ts).

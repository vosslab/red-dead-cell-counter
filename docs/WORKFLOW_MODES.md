# Counting and inspection workflows

## Start with the images

The saloon opens with **Choose images** and **Try an example**. Choosing files goes
directly to the counter. Try an example fetches the real A501 image only when requested,
then counts it through the same automatic pipeline used for uploads.

One selected image gives a single-image workspace; several give a multi-image ledger.
The number of files determines the scope. There is no mode selector or handoff step.

| Action | Scope | Saved result |
| --- | --- | --- |
| Count cells | Every selected image, sequentially | Each image's independently chosen threshold, centers, and analysis metadata |
| Select a ledger filename | One image | Shows its saved settings and markers without rerunning it |
| Count selected image with manual settings | Selected image only | Replaces that image's result with an explicitly manual analysis |
| Compare settings on selected image | Selected image only, 15-100 trials | Applies an actual tested representative median run as manual analysis |
| Download CSV | Complete selected file set, including partial work | Counts, status/errors, settings, method/version, and review reasons |

## Automatic and advanced settings

**Count cells** starts with diameter 10 px and k 4. Advanced changes to those two
values affect new automatic runs. The threshold is estimated separately from each
image's positive DoG response using binary Otsu; the Advanced manual threshold does
not replace that estimate. Existing counts retain their original settings until a
successful replacement result is saved.

**Advanced settings** holds manual controls and research comparisons. The comparison
mean, median, and population standard deviation describe variation across settings.
The representative median run is not an accuracy estimate or a parameter selector
for the whole batch. Inspect its actual markers before using that result.

All automatic results carry `provisional_calibration`: selection used eight images
with uncertain ImageJ totals and has no independent biological validation. Other
review reasons explain low signal, precision limits, or threshold sensitivity.
See [AUTOMATIC_DETECTOR_EXPERIMENT.md](AUTOMATIC_DETECTOR_EXPERIMENT.md).

## Partial work and recovery

Cancel counting stops pending work and preserves completed and previously saved
analyses. A failed or cancelled rerun can display the previous saved count; its status
and explanatory text identify that it belongs to the earlier analysis. CSV retains
that saved metadata alongside the current attempt's status/error. It also includes
unprocessed rows with empty count fields. Export works with one image and partial sets.

Choosing a new file set replaces the current selection. Export before changing sets.
Image selection, new runs, and settings changes are disabled while processing. Image
inspection uses the saved cutoff and shares Raw/DoG/Threshold views, zoom, and markers.

## Walkthrough and acceptance

Task analysis and cognitive walkthroughs ask whether a new biology student can identify
the next action and interpret the feedback. Browser, keyboard, and accessibility checks
verify the implementation. These are expert guideline checks, not an actual student
study; human participation is not a milestone gate.

| Scenario | Observable completion check |
| --- | --- |
| First visit | Choose images is visible on the saloon; selecting files opens the workbench. |
| No files available | Try an example loads real A501 pixels and produces an automatic count. |
| First count | Count cells processes one file and exposes count, markers, actual cutoff, and provisional notice. |
| Collection | Every file gets its own cutoff and saved metadata; ledger selection shows that image's result. |
| Advanced exploration | Manual analysis and comparison update only the selected row. |
| Cancel or fail | Finished and prior saved results remain available; CSV identifies partial or failed attempts. |
| Keyboard inspection | Buttons and tabs expose accessible names; focus, zoom, and arrow-key panning remain usable. |

Implementation owners: [counter_controller.ts](../src/counter_controller.ts),
[image_workspace.ts](../src/image_workspace.ts), [analysis_types.ts](../src/analysis_types.ts),
and [index.html](../src/index.html). Browser checks live in
[counter.spec.ts](../tests/playwright/counter.spec.ts); recorded verification belongs in
[VERIFICATION.md](VERIFICATION.md).

# Refinement and inspection workflows

## Start with the images

Choose one or several JPEG/PNG files. **Try an example** loads the real A501 image and
runs the same refinement pipeline. File count determines scope; no mode selector is
needed. Diameter, k, manual threshold, and trial-count controls are visible above
the workspace. Refinement is part of normal processing for every image.

| Action | Scope | Saved result |
| --- | --- | --- |
| Refine and count | Every chosen image, sequentially | Independent automatic refinement, centers, settings, and trial metadata. |
| Refine selected image | Selected image only | Same automatic pipeline and saved refinement metadata. |
| Select a ledger filename | One image | Restores its saved settings, markers, and refinement feedback without rerunning. |
| Count once with these settings | Selected image only | Entered diameter/k/threshold applied as manual analysis. |
| Apply on a trial row | Selected image only | Trial settings rerun and saved as manual analysis. |
| Download CSV | Chosen set, including partial work | Counts, status/errors, actual settings, method/version, reasons, and trial summaries. |

## Refine independently per image

For every image, the pipeline starts from fresh pixels and the entered diameter/k
estimates. Binary Otsu supplies a starting threshold. A 15-100-trial design (21 by
default) explores diameter/k/threshold, then applies an actual tested run closest to
the median count. A no-signal result returns zero and skips the sweep. The manual
threshold box is used only by **Count once with these settings**.

Diameter and k are starting estimates, not guaranteed measurements of cell size.
Visible statistics and trial progress support routine review; full trial rows and
design details can be expanded. Inspect the applied markers, then adjust estimates
and refine again where needed. The median rule does not optimize biological accuracy
or guarantee stable counts.

Automatic results use `dog_ccd_median` / `dog-refinement-1` and carry
`provisional_refinement`. A full trial count span greater than 10% of the selected
count adds `refinement_sensitive`. The combined pipeline has not been biologically
validated. The earlier eight-image study covers the Otsu starting-threshold method
only; see [AUTOMATIC_DETECTOR_EXPERIMENT.md](AUTOMATIC_DETECTOR_EXPERIMENT.md).

## Saved results and recovery

Editing inputs leaves existing counts attached to their actual saved settings.
Selecting a ledger row restores that image's settings and refinement feedback;
it does not set a recipe for the batch. Inspection uses saved settings in the
Raw/DoG/Threshold views and detection overlay.

**Cancel refinement** stops pending work and preserves completed and previously
saved analyses. A failed or cancelled rerun can retain an earlier count, identified
as a previous saved result. CSV keeps its actual metadata alongside the current
attempt status/error. Rows without completed analyses have empty count fields.

Download before changing the file set or leaving the page. Trial metadata, centers,
and images persist only in page memory for the current selection. CSV saves totals
and summary provenance, not all trial rows or a reloadable session.

## Workflow review boundaries

The intended audience is biology researchers with laboratory experience. Workflow
review asks whether parameter refinement, marker inspection, sensitivity feedback,
and export are clear in a normal processing session. Engineering and accessibility
checks do not establish biological accuracy or constitute a researcher usability study.

| Scenario | Observable completion check |
| --- | --- |
| First visit | Choose images opens the workspace; Try an example starts real-image refinement. |
| Normal refinement | Every chosen image gets an independent seed and parameter trials. |
| Inspection | Saved count, actual settings, markers, review notice, and trial feedback are available. |
| Selected refinement | Only the selected image is refined again. |
| Manual check | Count once or Apply updates only the selected image as manual analysis. |
| Cancel or fail | Completed and prior saved results remain available with current attempt status. |
| Export | CSV includes actual settings and refinement summaries for available results. |

Implementation owners: [counter_controller.ts](../src/counter_controller.ts),
[image_workspace.ts](../src/image_workspace.ts), [analysis_types.ts](../src/analysis_types.ts),
and [index.html](../src/index.html). Browser checks live in
[counter.spec.ts](../tests/playwright/counter.spec.ts); recorded verification belongs in
[VERIFICATION.md](VERIFICATION.md).

# Usage

Count PI-positive red fluorescent objects in JPEG or PNG microscopy images. Images
are decoded and processed on your device; the static site does not upload them.

## First count

1. Open [Red Dead Cell Counter](https://vosslab.github.io/red-dead-cell-counter/).
2. Select **Choose images**, open one or several files, then select **Count cells**.
   Or select **Try an example** to load and count the real A501 image immediately.
3. Inspect the markers, then select **Download CSV**.

Single-image and multi-image work use the same actions. Counting processes the selected
set sequentially and adjusts each image's threshold independently. All automatic counts
are provisional; inspect them before interpreting a biological result.

## Inspect the markers

- Select a filename on the bounty board to see its count and actual processing settings.
- **Raw** shows original RGB pixels. **DoG** shows contrast-stretched cell-scale response.
  **Threshold** shows the binary mask from the saved cutoff; white regions are not counts.
- Toggle **Show detections** to compare green center markers with the underlying image.
- Use **Actual pixels** or **Zoom**, drag to pan, and use **Fit image** to return.
  Arrow keys, scrollbars, and touch scrolling also navigate the image.
- Read the review notice. Automatic results always state provisional calibration status;
  additional notices can identify weak signal, cutoff sensitivity, or precision limits.

## Count an image set

Choose all files together, including a plate image set, then select **Count cells**.
One threshold is fitted to each image's pixels; a selected ledger row does not set a
recipe for other files. Select **Cancel counting** to stop. Completed results and
previously saved analyses remain available for inspection and CSV export.

A failed or cancelled rerun may retain an earlier count. The ledger and image summary
identify the attempt status and previous analysis. Export keeps its actual saved
settings alongside that status/error. Rows that have never completed have no count.
Choosing a new file set replaces the ledger, so download results first.

## Explore advanced settings

Open **Advanced settings** after selecting an image.

| Control or action | Effect |
| --- | --- |
| Cell diameter | Expected spot width in original pixels; 10 px initially, valid range 2-200. |
| DoG k | Relative background blur scale; 4 initially, valid range 1.1-8. |
| Response threshold | Manual raw DoG cutoff, initially 0.10000; a response value, not a percent. |
| Count selected image with manual settings | Runs the three manual settings on the selected image only. |
| Comparison runs | 15-100 manual trials, default 21. |
| Compare settings on selected image | Explores diameter, k, and threshold, then applies a tested representative median run. |

Changes to diameter/k affect future automatic runs. Automatic counting computes its
own threshold, regardless of the manual threshold field. Changing controls never
relabels an existing saved result. Diameter/k are rounded to two decimals and manual
threshold to five; threshold must exceed 0.00001 (minimum rounded value 0.00002).

Comparison mean, median, and population SD describe sensitivity to the tested settings,
not biological accuracy. Applying a run marks that image's analysis as manual. The
comparison does not choose parameters for a batch. See
[EXPERIMENT_DESIGN.md](EXPERIMENT_DESIGN.md).

## Inputs and outputs

Inputs are one or more JPEG/PNG files; the real example source is
[A501.jpg](../IMAGES/A501.jpg). **Download CSV** saves `dead-cell-counts.csv` through
your browser, including one-file and partial results. Each row records:

- Filename, original width/height, count, attempt status, and error.
- Actual diameter, k, and cutoff used for the saved analysis.
- Algorithm version, method, automatic/manual mode, review reasons, and no-signal flag.

Counts and overlays stay in memory for the current page. CSV contains totals and
provenance, not the full center-coordinate arrays or an analysis-session reload file.
For method limitations see [AUTOMATIC_DETECTOR_EXPERIMENT.md](AUTOMATIC_DETECTOR_EXPERIMENT.md);
for local build commands see [README.md](../README.md).

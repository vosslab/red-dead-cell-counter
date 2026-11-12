# Refine, inspect, and count

Use this workflow to refine processing parameters for your PI microscopy images,
review the resulting detections, and save counts with their actual settings. Open
[Red Dead Cell Counter](https://vosslab.github.io/red-dead-cell-counter/).
Images stay on your device; no account or installation is needed.

## Run the normal workflow

1. Select **Choose images** and open one or more JPEG/PNG files. **Try an example**
   loads the real A501 field and starts the same refinement pipeline immediately.
2. Review **Cell diameter (px)** and **DoG k**, visible above the workspace. These
   are starting estimates; the initial values are 10 px and 4. Select a trial count
   from 15-100 (21 by default), then select **Refine and count**.
3. Each image independently receives a binary Otsu starting threshold from its fresh
   pixels, followed by diameter/k/threshold trials. The tool applies an actual tested
   run closest to the median count. A no-signal image returns zero and skips the sweep.
4. Watch the progress and visible count statistics. Expand **Inspect all trial
   settings and counts** to compare individual runs, or **Design details and parameter
   ranges** to inspect the design. The median and SD describe the tested settings;
   they do not establish accuracy or guarantee stable counts.
5. Select a ledger filename to inspect that image's saved markers, settings, and trial
   feedback. Check isolated, faint, touching, and irregular objects in the original
   fluorescence. Adjust diameter/k and select **Refine selected image** where needed.
6. Select **Download CSV** before choosing a new file set or leaving the page.

The response threshold input is used only by **Count once with these settings**.
That action directly applies all three entered settings to the selected image and
saves a manual analysis. **Apply** on an individual trial reruns that trial's settings
and also marks the result as manual. Neither action changes other images.

Diameter and k are starting estimates, not guaranteed automatic cell-size measurements.
Refinement is required in the normal workflow; checking markers and refining again is
part of processing your images. The combined pipeline has not been biologically
validated. The eight-image calibration described in
[AUTOMATIC_DETECTOR_EXPERIMENT.md](AUTOMATIC_DETECTOR_EXPERIMENT.md) covers only the older
Otsu starting-threshold method.

## Illustrated processing session

<!-- screenshots:begin (managed by screenshot-docs) -->
## 1. Choose a field

<a href="screenshots/workflow_choose.webp"><img src="screenshots/workflow_choose.webp" width="720" alt="Western saloon entrance with Choose images and Try an example actions"></a>

Select **Try an example** to load and refine the real A501 microscope image.
In the captured local build, the applied trial returns **272** detections with
diameter **10.00 px**, k **2.65**, and threshold **0.26860**.

For your own images, select **Choose images** and open one or more JPEG/PNG files.
The workbench opens with your filenames on the wooden bounty board. Choosing
files alone leaves them waiting for **Refine and count**.

## 2. Refine your images

<a href="screenshots/workflow_count.webp"><img src="screenshots/workflow_count.webp" width="720" alt="Two images selected with visible diameter, k, threshold, trial count, and Refine and count"></a>

Review the visible diameter and k starting estimates. Select **Refine and count**
to process each image independently: estimate its starting threshold, explore
all three parameters, then apply an actual tested run closest to the median count.
The default is **21 trials per image**; you can choose **15-100**. The threshold
input is used only by **Count once with these settings**.

If you used **Try an example**, refinement has already finished. Select a ledger
filename to restore its saved count, actual settings, and refinement feedback.

## 3. Inspect the centers

<a href="screenshots/workflow_inspect.webp"><img src="screenshots/workflow_inspect.webp" width="720" alt="Refined A501 result with 272 detections, applied settings, review notice, zoom tools, and green markers"></a>

Green circles mark counted centers. Compare bright objects, faint objects, and
touching spots against the original fluorescence. The review notice identifies
this combined refinement pipeline as provisional and flags sensitivity to settings.

- Select **Actual pixels** to see original pixels at their native size.
- Increase **Zoom**, then drag to pan; arrow keys, scrollbars, and touch also work.
- Toggle **Show detections** to compare markers with unobscured fluorescence.
- Select **Fit image** to return to the overview.

Select an image in this guide to open its full-resolution file.

## Read the processing views

<a href="screenshots/viewer_views.webp"><img src="screenshots/viewer_views.webp" width="760" alt="Same A501 field with applied refinement settings in Raw, DoG, Threshold, and green counted centers"></a>

These panels follow the same **800 x 600 pixel A501 field** with the same saved
trial settings. Compare isolated and nearby spots across all four panels.

| View | What you see | What to check |
| --- | --- | --- |
| Raw | Original RGB fluorescence. | Are marked objects visible in the original image? |
| DoG | Cell-sized contrast emphasized by a Difference of Gaussians filter. | Which spots stand out from background? |
| Threshold | White pixels whose response meets the saved cutoff. | Which faint spots or joined regions survive? |
| Show detections | Green circles over the selected view. | Where are the counted centers? |

White regions are candidate pixels, not counts. One connected white region can
contain several centers. DoG brightness is stretched for display. Switching tabs
or changing display brightness leaves the saved count unchanged.

## 4. Read refinement feedback

<a href="screenshots/comparison.webp"><img src="screenshots/comparison.webp" width="720" alt="A501 automatic refinement with mean 252.3, median 272.0, standard deviation 150.2, and expanded trial rows"></a>

The example's normal refinement already produced these **21 trials**. This is a
provisional parameter-sensitivity result. Mean,
median, and standard deviation describe sensitivity to the tested settings.
The captured A501 counts range from **0 to 560**; the mean is **252.3**, median
**272.0**, and standard deviation **150.2**. This spread warrants inspection;
neither the median nor a narrow spread establishes biological accuracy.

Open **Inspect all trial settings and counts** to see each run. **Apply** chooses
one successful trial for the selected image. **Inspect applied detections** opens
its saved overlay. **Refine selected image** reruns the same automatic pipeline
for that image using the visible diameter/k starting estimates and trial count.
**Count once with these settings** directly uses all three entered values.

## 5. Measure threshold objects

<a href="screenshots/object_measurements.webp"><img src="screenshots/object_measurements.webp" width="720" alt="A501 object measurement ledger with five shape metrics and cohort counts"></a>

The paper ledger reports mean, median, population SD, and finite sample size for
**single-center objects away from image edges**. These shapes approximate cells;
they describe connected threshold pixels, not individually segmented cells.
The A501 capture has **221 objects**, including **187** with one center and
**34** with multiple centers. Its **182** interior single-center objects have mean
area **75.78 px&sup2;**, median **63.00 px&sup2;**, and population SD
**48.10 px&sup2;**. Mean equivalent diameter is **9.27 px**, roundness **0.94**,
inertia ratio **1.52** (179 finite values), and mean squared radius **12.53 px&sup2;**.

All-object, one-center, multiple-center, no-peak, and image-edge counts appear
separately. Edge membership overlaps the other cohorts.

- **Area** counts connected pixels; equivalent diameter is the diameter of a circle
  with that area. Both use pixels, without physical calibration.
- **Roundness** is 4 pi times area divided by squared perimeter. Raster measurement
  can produce values above 1.
- **Inertia ratio** is the major/minor covariance eigenvalue ratio, at least 1.
  Degenerate values are omitted from that metric's finite sample count.
- **Mean squared radius** is the mean squared distance of object pixels from their
  centroid, in squared pixels; it is not an intensity-weighted moment.

## 6. Inspect challenging regions

<a href="screenshots/challenge_clusters.webp"><img src="screenshots/challenge_clusters.webp" width="720" alt="H501 raw challenge crops with gold object bounds, accepted green centers, and Inspect this region actions"></a>

These real H501 crops use **Count once with these settings** at diameter **10 px**,
k **4**, threshold **0.10000**. This manual illustration differs from the default
refined H501 result below. It has **3,021** accepted centers across **2,642**
connected objects; its largest-center-count example retains **7 centers** in one
**2,042 px&sup2;** object. Gold boxes bound connected threshold objects; green
rings show only their accepted centers. A connected object can retain several
peaks through the existing peak and spacing rules. Shape measurements neither
split its boundaries nor reject its centers.

Select **Inspect this region** to zoom and pan the main viewer to the object.
The saved count stays unchanged. Compare the original fluorescence with its
markers before deciding whether to change the processing settings.

## 7. Save both CSVs

<a href="screenshots/batch.webp"><img src="screenshots/batch.webp" width="720" alt="Two-image refined ledger with A501 count 272, H501 count 2197, statistics, and Download CSV"></a>

The captured batch independently refines A501 to **272** and H501 to **2,197**.
Their saved thresholds are **0.26860** and **0.26307**, respectively; both applied
diameter **10.00 px** and k **2.65**. Your images will have their own results.

Select **Download CSV** to save `dead-cell-counts.csv`. Each row includes the
filename, dimensions, count, status/error, actual settings, method/version,
review reasons, and refinement summary statistics. Open it in LibreOffice Calc.

**Cancel refinement** preserves completed and previously saved analyses. A failed
or cancelled recount can retain an earlier count with its actual settings and
attempt status. Rows without a completed analysis have no count.

**Download before choosing a new file set or leaving the page.** A new selection
replaces the ledger. The count CSV saves totals, provenance, and morphology summaries. Select
**Download object measurements CSV** to save `object-measurements.csv`: one row
for every connected threshold object, including objects without a retained peak,
with geometry, centroid, bounding coordinates, edge flag, accepted-center count
and indices, and actual settings. It does not save individual center coordinates
or a reloadable analysis session. See [USAGE.md](USAGE.md) for valid ranges and
[EXPERIMENT_DESIGN.md](EXPERIMENT_DESIGN.md) for the trial design.

<!-- screenshots:end -->

## Interpret PI-positive objects

The stain, acquisition conditions, and visible objects matter when interpreting
red detections as cells. A red-channel image alone does not supply a total-cell
count or a percentage of viable cells. See
[Thermo Fisher's PI overview](https://www.thermofisher.com/us/en/home/life-science/cell-analysis/fluorophores/propidium-iodide.html).

## Where to go next

- [USAGE.md](USAGE.md): exact ranges, CSV fields, and local setup.
- [WORKFLOW_MODES.md](WORKFLOW_MODES.md): saved results and processing scope.
- [EXPERIMENT_DESIGN.md](EXPERIMENT_DESIGN.md): refinement trial design.
- [SCREENSHOTS.md](SCREENSHOTS.md): assets and recapture instructions.
- [README.md](../README.md): project front door and credits.

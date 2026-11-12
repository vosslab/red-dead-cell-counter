# Screenshot assets

Follow [WALKTHROUGH.md](WALKTHROUGH.md) for the guided visual tour. This page indexes
its assets and the capture route; [README.md](../README.md) uses the three focused
workflow images at a smaller display width. Select any linked asset to see full detail.

## Current interface captures

All views come from the local production build with real A501/H501 microscopy images.
They document the captured revision, without confirming the public deployment or
biological accuracy. Capture the normal workflow: choose images, review visible
starting estimates, refine each image, inspect trial feedback and markers, then export.
Use counts and settings from the capture receipt rather than earlier Otsu-only examples.

| Asset | Captured state |
| --- | --- |
| [workflow_choose.webp](screenshots/workflow_choose.webp) | Focused saloon entrance and file/example actions. |
| [workflow_count.webp](screenshots/workflow_count.webp) | Chosen images with visible starting estimates and Refine and count. |
| [workflow_inspect.webp](screenshots/workflow_inspect.webp) | Refined A501 result, review notice, zoom tools, and center markers. |
| [viewer_views.webp](screenshots/viewer_views.webp) | The same 800 x 600 A501 field in Raw, DoG, Threshold, and with centers. |
| [batch.webp](screenshots/batch.webp) | Two-image ledger with independently refined saved settings and CSV export. |
| [comparison.webp](screenshots/comparison.webp) | Normal refinement feedback, count statistics, and expanded real trial rows. |
| [object_measurements.webp](screenshots/object_measurements.webp) | Focused A501 paper ledger: five geometry metrics, explicit single-center interior population, cohorts, and object CSV. |
| [challenge_clusters.webp](screenshots/challenge_clusters.webp) | Real H501 manual d10/k4/0.10000 raw crops with gold bounds and retained green centers. |
| [saloon.webp](screenshots/saloon.webp) | Full saloon entrance. |
| [counter.webp](screenshots/counter.webp) | Full A501 automatic workbench. |

<details>
<summary>Full-screen reference thumbnails</summary>

<!-- screenshots:begin (managed by screenshot-docs) -->
<a href="screenshots/saloon.webp"><img src="screenshots/saloon.webp" width="320" alt="Full Western saloon entrance with image selection and example refinement actions"></a>

The full entrance preserves the saloon scene around the focused entrance crop.

<a href="screenshots/counter.webp"><img src="screenshots/counter.webp" width="320" alt="A501 workbench with visible refinement controls, progress, mean median and standard deviation, ledger, and saved detections"></a>

The full workbench places the parameter controls and refinement feedback above
the ledger and viewer. A501's applied trial counts 272 centers; its 21 trial
counts have mean 252.3, median 272.0, and standard deviation 150.2.

<!-- screenshots:end -->

</details>

## Reproduce the captures

After building and serving with `./run_web_server.sh`, use the local URL printed
by the server:

```sh
node tests/playwright/capture_readme.mjs http://127.0.0.1:4194/
```

Replace that example address with your server URL. The harness writes quality-90
WebPs and `generated/readme_screenshot_capture.json`. The three workflow assets are
focused crops of actual responsive app views; labels and explanations stay in the
Markdown documents. The processing comparison uses the same field and saved settings
for all four panels. White threshold regions are candidate pixels, not cell counts.

The harness also checks actual processing pixels, green overlays, refinement rows,
per-image CSV metadata, object CSV center conservation, saved measurements after
control edits, and Inspect zoom without recounting. It checks the new table and
gallery at widths 320, 768, 1440, and 1920 pixels. Running it provides capture evidence, not a substitute
for biological validation. [VERIFICATION.md](VERIFICATION.md) owns the engineering
receipts; [AUTOMATIC_DETECTOR_EXPERIMENT.md](AUTOMATIC_DETECTOR_EXPERIMENT.md) owns the
method's calibration limitations.

## Historical experiment evidence

[adaptive_blob_loss.webp](screenshots/adaptive_blob_loss.webp) remains an intentional
example of a failed experimental consolidation policy in
[ADAPTIVE_BLOB_EXPERIMENT.md](ADAPTIVE_BLOB_EXPERIMENT.md). It is not a current UI capture.

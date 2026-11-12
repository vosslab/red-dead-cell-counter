# Screenshot assets

Follow [WALKTHROUGH.md](WALKTHROUGH.md) for the guided visual tour. This page indexes
its assets and the capture route; [README.md](../README.md) uses the three focused
workflow images at a smaller display width. Select any linked asset to see full detail.

## Current interface captures

All views come from the local production build with real A501/H501 microscopy images.
They document the captured revision, without confirming the public deployment or
biological accuracy. The example automatic result is A501: **291** detections at
cutoff **0.26860**. Advanced comparison subsequently applies a manual result, so its
count can differ from that first automatic count.

| Asset | Captured state |
| --- | --- |
| [workflow_choose.webp](screenshots/workflow_choose.webp) | Focused saloon entrance and file/example actions. |
| [workflow_count.webp](screenshots/workflow_count.webp) | Two chosen images waiting for Count cells. |
| [workflow_inspect.webp](screenshots/workflow_inspect.webp) | Automatic A501 result, review notice, zoom tools, and center markers. |
| [viewer_views.webp](screenshots/viewer_views.webp) | The same 800 x 600 A501 field in Raw, DoG, Threshold, and with centers. |
| [batch.webp](screenshots/batch.webp) | Two-image ledger with separate saved automatic cutoffs and CSV export. |
| [comparison.webp](screenshots/comparison.webp) | Advanced manual comparison and 21 real trial rows. |
| [saloon.webp](screenshots/saloon.webp) | Full saloon entrance. |
| [counter.webp](screenshots/counter.webp) | Full A501 automatic workbench. |

<details>
<summary>Full-screen reference thumbnails</summary>

<!-- screenshots:begin (managed by screenshot-docs) -->

[<img src="screenshots/saloon.webp" width="320" alt="Full Western saloon entrance with image selection and example actions">](screenshots/saloon.webp)

The full entrance preserves the saloon scene around the focused Choose image.

[<img src="screenshots/counter.webp" width="320" alt="Full A501 automatic workbench with bounty board, actual settings, and image viewer">](screenshots/counter.webp)

The full workbench shows where the board, saved settings, and viewer sit together.

<!-- screenshots:end -->

</details>

## Reproduce the captures

After building and serving with `./run_web_server.sh`, use the local URL printed
by the server:

```sh
node tests/playwright/capture_readme.mjs http://127.0.0.1:4193/
```

Replace that example address with your server URL. The harness writes quality-90
WebPs and `generated/readme_screenshot_capture.json`. The three workflow assets are
focused crops of actual responsive app views; labels and explanations stay in the
Markdown documents. The processing comparison uses the same field and saved settings
for all four panels. White threshold regions are candidate pixels, not cell counts.

The harness also checks actual processing pixels, green overlays, comparison rows,
and per-image CSV metadata. Running it provides capture evidence, not a substitute
for biological validation. [VERIFICATION.md](VERIFICATION.md) owns the engineering
receipts; [AUTOMATIC_DETECTOR_EXPERIMENT.md](AUTOMATIC_DETECTOR_EXPERIMENT.md) owns the
method's calibration limitations.

## Historical experiment evidence

[adaptive_blob_loss.webp](screenshots/adaptive_blob_loss.webp) remains an intentional
example of a failed experimental consolidation policy in
[ADAPTIVE_BLOB_EXPERIMENT.md](ADAPTIVE_BLOB_EXPERIMENT.md). It is not a current UI capture.

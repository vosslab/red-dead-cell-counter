# A visual tour

Open [Red Dead Cell Counter](https://vosslab.github.io/red-dead-cell-counter/) to try
the same workflow. No account or installation is needed; selected images stay on your device.

The views below show the saloon entrance, an inspected H501 count, batch analysis,
a processing guide, and H501's completed setting comparison. The comparison statistics
describe sensitivity to settings rather than biological accuracy.

The processing guide follows the **same H501 field** through four stages. Raw shows
red fluorescence; DoG emphasizes cell-sized features; the threshold mask keeps pixels
whose DoG response passes the cutoff. The final panel adds **green circles at counted
centers**. White mask regions are not the cell count: a joined region can contain several
peaks. These are labeled crops from actual app outputs, with repeated controls removed
so the processing differences are easier to see.

<!-- screenshots:begin (managed by screenshot-docs) -->
![Western entry screen before image selection](screenshots/saloon.webp)
![H501 counted with the comparison-selected settings](screenshots/counter.webp)
![Batch ledger with completed H501 and A501 image counts](screenshots/batch.webp)
![Same H501 field: raw fluorescence, DoG response, threshold mask, and counted centers](screenshots/viewer_views.webp)
![H501 setting comparison with count statistics and design rows](screenshots/comparison.webp)
<!-- screenshots:end -->

Start with **Single image** and **Compare settings**, then **Inspect applied detections**.
Use **Use settings for batch** to carry the applied settings into a batch and download CSV.
To reproduce the examples, save [H501.jpg](../IMAGES/H501.jpg) or [A501.jpg](../IMAGES/A501.jpg)
and choose that file in the browser.

The captures are generated from the local production build. They do not imply that
the live deployment contains the same revision. See [VERIFICATION.md](VERIFICATION.md)
for capture commands, checks, and the current documentation receipt.

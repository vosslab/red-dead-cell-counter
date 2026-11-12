# A visual tour

Open [Red Dead Cell Counter](https://vosslab.github.io/red-dead-cell-counter/) to try
the same workflow. No account or installation is needed; selected images stay on your device.

The views below show the saloon entrance, an inspected H501 count, batch analysis,
the same A501 region in Raw/DoG/Threshold, and H501's completed setting comparison.
Green circles mark detections. The three processing views let you compare the original
red fluorescence with the filter response and binary mask. The comparison statistics
describe sensitivity to settings rather than biological accuracy.

<!-- screenshots:begin (managed by screenshot-docs) -->
![Western entry screen before image selection](screenshots/saloon.webp)
![H501 counted with the comparison-selected settings](screenshots/counter.webp)
![Batch ledger with completed H501 and A501 image counts](screenshots/batch.webp)
![A501 touching region across Raw, DoG, and Threshold views](screenshots/viewer_views.webp)
![H501 setting comparison with count statistics and design rows](screenshots/comparison.webp)
<!-- screenshots:end -->

Start with **Single image** and **Compare settings**, then **Inspect applied detections**.
Use **Use settings for batch** to carry the applied settings into a batch and download CSV.
To reproduce the examples, save [H501.jpg](../IMAGES/H501.jpg) or [A501.jpg](../IMAGES/A501.jpg)
and choose that file in the browser.

The captures are generated from the local production build. They do not imply that
the live deployment contains the same revision. See [VERIFICATION.md](VERIFICATION.md)
for capture commands, checks, and the current documentation receipt.

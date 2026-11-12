# Browser-Wasm design-of-experiments results

## Scope

This is a measurement of the deployed detector path, not a synthetic surrogate.
A local Chromium page loaded the built browser worker and its Rust WebAssembly module,
then processed the full-resolution supplied JPEGs. The detector request API was unchanged.
Raw output is retained outside the repository at
`/private/tmp/red-cell-experiment/doe-browser-results.json`.

The response is the number of detected local maxima. Reference counts are the supplied
human red-cell counts in `docs/REFERENCE_COUNTS.csv`; they were used to describe agreement,
not to choose a different setting during this run.

## Central composite design around the default

The 15-run, log-space central composite design was evaluated on two contrasting real
images: A501 and B301. It has one center point, eight factorial points, and six axial
points. Around diameter 10 px, k 4, and threshold 0.1, it covers:

| Factor | Axial low | Center | Axial high |
| --- | ---: | ---: | ---: |
| Diameter (px) | 5 | 10 | 20 |
| DoG k | 2 | 4 | 8 |
| Threshold | 0.025 | 0.1 | 0.4 |

The factorial values are diameter 6.622 or 15.101 px, k 2.649 or 6.040,
and threshold 0.04385 or 0.22803. Those non-round values are intentional: each
factor is balanced in log space.

| Image | Human reference | DoE min-max | Mean | Median | Population SD | Actual run nearest median |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| A501 | 362 | 184-587 | 348.9 | 339 | 105.6 | d=10, k=4, t=0.1; 339 |
| B301 | 235 | 114-633 | 318.0 | 294 | 164.5 | d=10, k=4, t=0.1; 294 |

The representative selector chooses an *evaluated* count nearest the experiment's
median, resolving ties toward the log-space center; it does not invent an untested
parameter combination. Here the center setting itself is the representative run for
both images. The large spreads, especially B301, say that stability cannot be inferred
from one image or from the mean alone.

## Very-low threshold check

At fixed diameter 10 px and k 4, thresholds below 0.001 execute successfully in the
same browser-Wasm path. They are not uniformly preferable.

| Image | Human reference | t=0.0001 | t=0.001 | t=0.01 | t=0.1 |
| --- | ---: | ---: | ---: | ---: | ---: |
| A501 | 362 | 461 | 448 | 380 | 339 |
| B301 | 235 | 7,993 | 7,053 | 1,195 | 294 |

On A501, 0.01 happened to be closer to its human reference (absolute difference 18)
than 0.1 (23); 0.001 and 0.0001 were worse. On B301, decreasing the threshold created
a severe overcount relative to the human reference. Thus the interface should permit tiny positive values
and the DoE can explore around them, but neither this pair nor the supplied labels
support a general rule that lower thresholds are better.

## Center-setting check across all supplied images

The default setting (diameter 10 px, k 4, threshold 0.1) was run on all eight real
images at their native dimensions (approximately 4,250 by 4,250 px):

| Image | Human reference | Browser-Wasm count | Difference | Absolute percentage error |
| --- | ---: | ---: | ---: | ---: |
| A101 | 332 | 398 | +66 | 19.9% |
| A501 | 362 | 339 | -23 | 6.4% |
| B301 | 235 | 294 | +59 | 25.1% |
| C601 | 270 | 296 | +26 | 9.6% |
| E401 | 450 | 546 | +96 | 21.3% |
| F201 | 1,050 | 1,172 | +122 | 11.6% |
| H1001 | 745 | 785 | +40 | 5.4% |
| H501 | 2,997 | 3,021 | +24 | 0.8% |

Mean absolute percentage error over these same eight calibration images is 12.5%.
These are calibration results, not an independent validation claim. The two most
informative observed failure modes are parameter-sensitive weak/noisy peaks (B301)
and count suppression/merging as the effective diameter increases. Visual overlays
remain the appropriate check before applying a batch setting to a new staining or
microscope condition.

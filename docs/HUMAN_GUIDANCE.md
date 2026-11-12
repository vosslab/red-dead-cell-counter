# Human guidance

<!-- VENDORED HEADER: START -->
Record the durable guidance Neil Voss states, or approves for preservation here, in his own words:
first person or close paraphrase, one to three lines per bullet. Material he supplies as a source
may inform [DESIGN_DECISIONS.md](DESIGN_DECISIONS.md) once it is settled, and an entry of uncertain
origin belongs there too. Rules: [REPO_STYLE.md](REPO_STYLE.md).
[PROPAGATED HEADER - ENTRIES BELOW ARE YOURS]
<!-- VENDORED HEADER: END -->

- I want a GitHub Pages tool that lets researchers upload propidium-iodide images and
  count dead cells using a TypeScript frontend and Rust/Wasm processing backend.
- Keep `main.ts` focused on orchestration; split substantial responsibilities into
  cohesive modules before the entry point approaches the source-file line limit.
- Make the README and screenshots inviting to new biology students so they want to
  try the software.
- Make the differences between processing-view screenshots clear; three similar-looking
  images do not explain what the figure is supposed to show.
- Support single-image testing and batch processing of an entire 96-well plate image set
  with CSV download. The count should be automatic.
- Use approximate cell size with a Difference of Gaussians filter. From experience, k
  should be tested around 3 to 6 rather than assumed to be 1.1.
- Take thresholded blob area into account. Examine my Appion `peakarea`, `peakmoment`,
  and roundness work in `OTHER_REPOS/leginon/pyami/imagefun.py`; moment of inertia
  and roundness might help characterize cells and clumps.
- Translate the Python blob measurements to Rust/Wasm for the GitHub Pages tool;
  Python can remain the experiment and reference implementation.
- Treat my related DoG Picker paper as relevant method evidence. My human calibration counts
  are A101 332, A501 362, C601 270, E401 450, F201 1050, and H501 2997.
- I want to compare settings on one image before applying the selected setting to a batch.
- Measure whether interface work would be faster in Rust/Wasm, and port the parts
  that show a useful improvement.
- I want more of a Design of Experiments approach, with a more orthogonal factorial design
  that covers more parameter space and better values.
- Thresholds below 0.001 may work in some cases.
- Investigate alternatives to a fixed threshold, including picking at several thresholds
  and merging results; use my DoG Picker paper and retain thresholds below 0.001.
- Round settings used for processing and CSV as well as display: diameter and k to
  two decimal places, threshold to five. Require threshold strictly greater than 0.00001.
- Use comma-separated counts, include mean and median in the comparison table, and
  make Compare settings the recommended first action. Default to 15-25 runs and allow up to 100.

- Give the interface a dark look with an ode to Red Dead Redemption.
- The program's name is "Red Dead Cell Counter," matching the theme of "Red Dead Redemption."
- Keep the workbench header short so researchers reach the image and controls higher on the page.
- Single-image and batch processing should be different modes so the workflow is obvious.
- Make the theme more Wild West, with a saloon entrance before image loading, wanted
  posters, wood, horses, a longhorn cattle skull, and saguaro cacti.

- Additional calibration counts: B301 is 235 and H1001 is 745.

- Compare settings should give more feedback; use the human interaction expert skill to improve it.

- Zoom must magnify enough to inspect individual detection picks.
- Support click-and-drag image scrolling to navigate between particles.
- Show Raw, DoG, and Threshold image views, with tabs at the top of the image viewer.
- Use UI/UX and human-interaction assessment to improve the interface, and implement
  the useful changes without waiting for my approval.

- Include mean, median, and standard deviation of comparison Counts in the long summary as possible count estimates.

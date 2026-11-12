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
- Support single-image testing and batch processing of an entire 96-well plate image set
  with CSV download. The count should be automatic.
- Use approximate cell size with a Difference of Gaussians filter. From experience, k
  should be tested around 3 to 6 rather than assumed to be 1.1.
- Treat my related DoG Picker paper as relevant method evidence. My human calibration counts
  are A101 332, A501 362, C601 270, E401 450, F201 1050, and H501 2997.
- I want to compare settings on one image before applying the selected setting to a batch.

- Give the interface a dark look with an ode to Red Dead Redemption.

- Additional calibration counts: B301 is 235 and H1001 is 745.

- Compare settings should give more feedback; use the human interaction expert skill to improve it.

- Zoom must magnify enough to inspect individual detection picks.

- Include mean, median, and standard deviation of comparison Counts in the long summary as possible count estimates.

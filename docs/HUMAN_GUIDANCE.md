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
- Make the README more visual with smaller, focused screenshots that explain the process;
  put the full guided process in a separate walkthrough. I will handle testing for this refresh.
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
- For preproduction experiments, do not carry legacy compatibility burdens into a conditional
  implementation. Use uncertain ImageJ counts within 10 percent, test higher thresholds for
  unusually large blobs, and let agent-owned milestones finish without human gates.
- Finish the obvious authorized work and record measured results before making broader claims.

- Test uncertain methods with small comparisons and measurements before fixing the design; distinguish
  hypotheses from evidence.
- Keep solutions to the smallest coherent design that meets demonstrated needs; add mechanisms,
  abstractions, policies, state, or tests only when evidence shows they are needed ([REPO_STYLE.md](REPO_STYLE.md)).
- Turn required gaps into implementation tasks in the current plan, then finish that work.
- Dream big, then make the ambition practical with missing artifacts, clear success criteria, and
  owned tasks that can be dispatched and completed ([REPO_STYLE.md](REPO_STYLE.md)).

- Make the first-use experience empathetic to biology beginners. This design judgment
  is difficult for me; use the agents' interface expertise to make it approachable.
- Tune each image independently. Favor count quality over speed, and prefer a solution
  that adjusts only the threshold when that works.
- Keep the cell diameter, DoG k, response threshold, and comparison runs entry boxes in one
  aligned row on wide screens, with clean wrapping on smaller screens.

- The audience is graduate biology researchers with laboratory experience; keep refinement
  in the main workflow and its controls visible, rather than hidden at the bottom in Advanced.
- The default GO action must actually refine multiple parameters for each image, including
  every image in a batch; refinement is required, not an optional comparison step.

- Show scientists descriptive data such as roundness, moment-related measurements, and
  average dead-cell area, plus sample challenging clusters and how the software handles them.

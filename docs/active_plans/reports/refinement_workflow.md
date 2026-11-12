# Refinement workflow ledger

## Current contract

Date: 2026-11-12. Audience: graduate biology researchers with laboratory experience.
Refinement is required in the main workflow, with visible controls and a primary
Refine and count action for every selected image. Refine selected image processes one;
Count once with these settings is manual and selected-image only.

Fresh RGBA -> Rust binary Otsu seed at visible initial diameter/k -> existing 15-100-point
design (default 21) -> existing representative median selection -> cached final detection.
A no-signal seed terminates with zero and skips design trials. The threshold entry is
manual-only; diameter/k are starting estimates, not automatically measured cell size.

Each saved image retains trial metadata and its own representative/selected indices,
plus final centers only. Selection restores that image's trials; applying another trial
performs fresh detection and marks the saved result manual. Controls never relabel saved
results. CSV appends requested/successful/failed trials, seed method/threshold, and
mean/median/population SD/minimum/maximum. The combined pipeline is provisional; the
Otsu eight-image experiment calibrates the seed only. Count spread is sensitivity evidence.

## Researcher task model

This cognitive walkthrough and source/capture inspection is an expert assessment, not a
participant study. Desktop laboratory work is the primary setting; narrow views retain
usable controls, feedback, and inspection.

| Task | Information needed | Acceptance evidence |
| --- | --- | --- |
| Choose images | Image identity and selected scope | Source review and browser documentation capture |
| Start refinement | Primary action processes every image independently | Shared operation/controller source; actual-image capture |
| Inspect estimates | Visible initial settings, progress, mean, median, SD, and caveats | Source review and readable desktop/narrow capture |
| Inspect picks | Final settings and centers belong to the selected image | Saved-analysis source; actual-image capture |
| Revisit trials | Each image restores its own rows and selected trial | Controller/panel source; capture of restored state |
| Apply another trial | Selected image gets fresh centers and manual provenance | Source review; documentation capture |
| Export or recover | CSV uses saved results; failures preserve prior counts honestly | Source review; capture/export receipt if performed |

These acceptance checks establish documented implementation behavior, not researcher
comprehension, cross-browser coverage, or independent biological accuracy.

## Atomic ownership ledger

One owner per outcome; the manager records handoffs and receipts after integration.

| Task | Owner | Outcome | State / evidence |
| --- | --- | --- | --- |
| Shared refinement engine | Refinement engine agent | Fresh seed, design, representative rerun, metadata | Complete; source review accepts |
| Controller | Workflow controller agent | All/selected refinement, cancellation, saved per-image state | Complete; source review accepts |
| Presentation | Results presentation agent | Statistics, restored trials, CSV summaries, provenance | Complete; source review and real-image CSV capture |
| Main controls | UI agent | Visible controls and clear action scope | Complete; 320/768/1440/1920 px captures |
| Test maintenance | Test owner | Update affected fixtures/contracts without running app suites | Complete; tests written, static checks pass, execution deferred to user |
| Contract documentation | Documentation agent | Guidance, decisions, architecture, evidence boundaries | Complete; current contract and scoped receipts recorded |
| Build and captures | Capture owner | Static/build receipt and inspected actual-browser WebP captures | Complete; production build and eight final WebPs |
| Independent review | Review owner | Reconcile final code/docs and record blockers | Complete; fresh SPEC and QUALITY accept with no blockers |

Integration review ACCEPT (2026-11-12): final engine/controller/panel/CSV composition,
README/walkthrough, and current capture receipts agree; final control and inspection
WebPs inspected. Application suites, axe, public deployment, and independent biological
validation are outside this review; refinement remains provisional.

## Final implementation receipts

Fresh specification review `refinement_spec_rereview` and quality review
`refinement_quality_review` accept the source with no blockers. The shared operation uses
the existing design and representative median selector; no Rust, worker ABI, detector math,
or dependencies change. Automatic choice preserves the user's starting diameter/k.
Cancelling a first refinement retains partial trials without an inert Apply action;
an interrupted rerun retains previously saved count/trials. Provenance is under design
details, while normal settings and the primary refinement action remain visible.

Both TypeScript configuration checks, focused ESLint with zero warnings, and focused
Prettier pass on the final changed TS/MJS files. The canonical production build passes:

```sh
WASM_PACK_CACHE=/Users/vosslab/.cache/wasm-pack ./build_github_pages.sh
```

The browser specification is split from 911 lines into an 830-line counter specification
and 96-line worker-log helper. Affected tests are adapted, a new engine test is written,
and disclosure tests open the real summary before Apply. New-test `node --check` syntax
passes; these tests are not executed.

## Browser capture receipts

Capture time: 2026-11-12T21:05:56Z. The actual production browser processes A501/H501,
renders their saved processing views and detection markers, and exports their CSV.
Both images complete 21 successful trials and zero failures.

| Image | Final count | Diameter | k | Threshold | Mean | Median | Population SD | Range |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| A501 | 272 | 10 | 2.65 | 0.26860 | 252.33 | 272 | 150.18 | 0-560 |
| H501 | 2,197 | 10 | 2.65 | 0.26307 | 2,158.95 | 2,197 | 1,302.60 | 0-4,746 |

CSV records `dog_ccd_median`, `dog-refinement-1`, `automatic`, and review reasons
`provisional_refinement; refinement_sensitive`. These counts agree less well with uncertain
human references A501 362/H501 2,997 than previous seed counts 291/2,456. The requested
workflow is implemented; these observations establish no counting-accuracy improvement
and no independently validated biological optimizer.

Eight final quality-90 WebPs have longest edges at most 1,920 px and sizes
24,614-151,460 bytes. Encoded assets are inspected at intended document sizes: three
README crops at 520 px, walkthrough views at 720 px, the processing guide at 760 px,
and reference images at 320 px; the native counter/inspection is also inspected.
All nine screenshot assets remain referenced, including the unchanged historical
adaptive-blob loss example. Receipts remain in ignored
`generated/readme_screenshot_capture.json` and `output_refinement_visual/capture_receipt.json`.

Visible settings and the primary action fit widths 320, 768, 1,440, and 1,920 px without
page overflow. At the captured 1,440 px frame, compact feedback falls from about 460
to 312 px high and the canvas starts at y=1,035 rather than y=1,274. The port-4194 local
capture server is stopped.

## Expert interaction inspection

The HCI and UI/UX skill methods frame this as an expert cognitive walkthrough for an
existing desktop laboratory tool. The decision is whether researchers can discover required
refinement, inspect settings sensitivity and picks, then export saved per-image results.
The task model above supplies the inspection criteria. The ratings below are subjective
Nielsen heuristic severity estimates: 0 = no observed issue, 1 = cosmetic, 2 = minor,
3 = major, 4 = catastrophic. "Before" refers to the superseded hidden, optional Advanced
workflow against the current graduate-researcher refinement goal; it is a retrospective
source/document inspection, not a controlled before/after usability study.

| Heuristic | Before | After | Inspection rationale |
| --- | ---: | ---: | --- |
| Visibility of system status | 2 | 1 | Main feedback exposes progress and spread; long runs still require waiting. |
| Match to researchers' work | 3 | 1 | Refinement and settings are visible; interpreting sensitivity still needs expertise. |
| User control and freedom | 2 | 1 | Cancel preserves prior counts; a first cancellation retains incomplete trials. |
| Consistency and standards | 2 | 1 | All/selected/manual action labels state scope; technical terms remain. |
| Error prevention | 2 | 1 | No inert Apply for partial first trials; marker inspection remains necessary. |
| Recognition over recall | 3 | 1 | Starting settings, statistics, and saved trials are accessible in the normal flow. |
| Flexibility and efficiency | 2 | 1 | Per-image batch refinement and selected reruns share the existing engine. |
| Aesthetic and minimalist design | 2 | 1 | Compact feedback reduces vertical displacement; the scientific workflow stays dense. |
| Error recognition and recovery | 2 | 1 | Saved counts and provenance survive interrupted reruns; partial results are explicit. |
| Help and documentation | 2 | 1 | Current screenshots and walkthrough explain refinement and provisional results. |

Source reviews support state handling; real-image documentation captures support visible
controls, readable output, actual CSV, and measured layout. No participant completion,
comprehension, or timing data is collected. No current axe scan or complete measured
accessibility audit is available, so these ratings do not establish WCAG conformance.

## Evidence boundary

The user owns application testing for this refresh. No application test suites run:
no Node test runner, pytest, Cargo test, or Playwright test runner. Static/build and
documentation-capture receipts are recorded above and in
[VERIFICATION.md](../../VERIFICATION.md). No axe scan runs because its dependency is absent;
no live publication verification or independent biological validation is performed.
Final documentation checks pass: 14 changed Markdown documents use ASCII, all 160 local
link targets exist, the README first paragraph is 196 characters, and `git diff --check`
is clean. These are static documentation checks, not application test-suite results.
Historical 1,155-pytest, 17-Rust-test, parity, and stress receipts predate this changed
workflow. They are preserved as historical evidence, without extending their claims.

# Design decisions

<!-- VENDORED HEADER: START -->
Record each durable decision about how this code and repository are shaped, once it is settled, with
the reasoning a later reader needs. Guidance Neil Voss states belongs in
[HUMAN_GUIDANCE.md](HUMAN_GUIDANCE.md), dated history in `docs/CHANGELOG.md`, open discussion in
`docs/active_plans/decisions/`. [PROPAGATED HEADER - ENTRIES BELOW ARE YOURS]
<!-- VENDORED HEADER: END -->

Write each decision as a level-three heading with these four fields. `Owner` names the
authoritative code or contract document, rather than a person.

```markdown
### <decision title>

**Decision.** <the durable direction>

**Why.** <the reason it was chosen>

**Consequence.** <the constraint a future change preserves>

**Owner.** <the authoritative code or contract doc>
```

### Browser-local image processing

**Decision.** Decode JPEG and PNG images in the browser and process their RGBA pixels in
a WebAssembly worker.

**Why.** A static GitHub Pages site has no server-side image store, and the supplied images
are large enough that processing must not freeze the user interface.

**Consequence.** Uploaded images do not leave the browser. The worker owns sequential batch
processing and returns compact center-coordinate results.

**Owner.** `src/main.ts` and `src/worker.ts`

### Matched Difference of Gaussians detector

**Decision.** Extract red signal and detect local maxima in a float Difference of Gaussians
response. Derive Gaussian scales from target cell radius and k using equation 4 from Voss
et al., *DoG Picker and TiltPicker*.

**Why.** This is the user-selected method and it separates nearby bright objects better than
counting raw thresholded connected components.

**Consequence.** The verified starting values are a 10-pixel target diameter, k = 4, and
response threshold 0.10. A single-image comparison runs 27 nearby settings: diameter at 75%,
100%, and 125%; k at 3, 4, and 6; and threshold at 50%, 100%, and 200%. Auto-tune scores
each result by the sum of count ranges normalized by each line's median along its three diameter, k, and
threshold lines, excludes zero neighbors when the center count is nonzero, and breaks ties in
favor of the center setting. It measures parameter stability, not counting accuracy. Applying
one result uses its exact setting for later batch work.

**Owner.** `rust/src/lib.rs` and `docs/DETECTOR_EXPERIMENT.md`

### Minimal Rust image stack

**Decision.** Use `image`, `imageproc`, and `wasm-bindgen`; leave JPEG/PNG decoding to the
browser.

**Why.** `imageproc` supplies the necessary float Gaussian operation while the browser
already decodes the supported upload formats.

**Consequence.** Rust receives decoded RGBA pixels and its public Wasm boundary validates
dimensions, buffer length, and numeric detector inputs.

**Owner.** `rust/Cargo.toml` and `rust/src/lib.rs`

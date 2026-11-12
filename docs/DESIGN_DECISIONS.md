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
response threshold 0.10. Single-image comparison uses a 15-run central composite design:
eight factorial corners, six axial points, and one center. For three factors, alpha = 8^(1/4),
following the [NIST central composite design guidance](https://www.itl.nist.gov/div898/handbook/pri/section3/pri3361.htm).
Diameter, k, and threshold vary in continuous logarithmic coordinates. The outer valid ranges
are 5 to 20 pixels, k = 2 to 8, and threshold 0.025 to 0.4; when a requested center would
exceed a range, that factor's log window recenters at the range's geometric mean without
changing the 15-run design. The interface displays the requested start and actual center/ranges.
The representative median run is the actual tested run closest to the median successful count,
with ties resolved by logarithmic distance from the center. Auto-tune may apply that run to a
batch. This describes a representative result, not an accuracy optimizer or quadratic-model
optimizer. The summary keeps mean, median, and population standard deviation across successful
runs.

**Owner.** `rust/src/lib.rs` and `docs/DETECTOR_EXPERIMENT.md`

### Minimal Rust image stack

**Decision.** Use `image`, `imageproc`, and `wasm-bindgen`; leave JPEG/PNG decoding to the
browser.

**Why.** `imageproc` supplies the necessary float Gaussian operation while the browser
already decodes the supported upload formats.

**Consequence.** Rust receives decoded RGBA pixels and its public Wasm boundary validates
dimensions, buffer length, and numeric detector inputs.

**Owner.** `rust/Cargo.toml` and `rust/src/lib.rs`

### Saloon entrance and Western surfaces

**Decision.** Open on an illustrated saloon with one Enter saloon button. Keep the
counter hidden until entry, then focus its heading. Use original SVG art, CSS wood
surfaces, and aged-paper wanted posters and results.

**Why.** The requested Western theme needs a recognizable place and materials.
Local assets keep the static tool self-contained.

**Consequence.** Entry requires one click or keyboard activation on each page load.
Decorative art stays silent to assistive technology, door motion honors reduced
motion, and microscopy images retain a neutral dark viewing surface.

**Owner.** `src/index.html`, `src/style.css`, `src/assets/`, and `src/main.ts`

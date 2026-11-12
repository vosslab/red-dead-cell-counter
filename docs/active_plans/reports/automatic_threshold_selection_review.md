# Automatic threshold selection review

What this change does: it shares the existing native DoG response with three image-derived
threshold candidates, evaluates their saved counts, and chooses one rule for every future image.
The approved automatic feature estimates a separate cutoff from each image.

## Verdict and scope

**SPEC ACCEPT.** Choose `binary_otsu`, with version `automatic-dog-1` and the durable
`provisional_calibration` review reason. Proceed with the selected Wasm wrapper and later
integration milestones. This accepts M4's method decision and native numerical specification;
it does not accept the unfinished browser, export, recovery, or parity milestones.

No algorithm-selection blocker or architectural drift was found. The current approved
[automatic_image_counting_plan.md](../../archive/automatic_image_counting_plan.md) requires an
image-specific automatic method even when its calibration evidence is provisional. Fixed 0.10
and 0.12 remain experiment comparisons and manual controls; neither replaces automatic inference.

Reviewed on 2026-11-12 by an independent selector reviewer. Read-only implementation scope:
`rust/src/automatic_threshold.rs`, `rust/src/prepared_image.rs`, `rust/src/lib.rs`, both native
probes, `devel/benchmark_automatic_methods.py`, native tests, and the complete saved experiment.
The review writes only this report. Production files, tests, configuration, and Git history are
unchanged by this reviewer. Other owners work concurrently.

Rules applied: `AGENTS.md`, repository, Python, pytest, Markdown, Rust, and Rust/Wasm style,
and the latest changelog entry. Python checks use `source source_me.sh && python3`.
The decisions apply **Scientific method**, **KISS**, **Reviews should simplify**, and
**Focus on important issues** from [REPO_STYLE.md](../../REPO_STYLE.md).

## Independent selection calculation

Recomputed every summary from the complete saved prediction arrays and the human totals,
without importing the benchmark's scoring helper. The interval is `[H/1.1, H/0.9]` and outside
loss is `max(H/1.1-count, count-H/0.9, 0)/H`. Automatic candidates rank by outside-image count,
worst outside loss, mean outside loss, then the fixed simplicity order binary Otsu, Li,
three-class Otsu. Fixed comparisons do not enter that ranking.

All five computed summaries agree exactly with the saved numeric values.

| Rule | Outside images | Worst outside loss | Mean outside loss | Center MAPE |
| --- | ---: | ---: | ---: | ---: |
| Binary Otsu | 3/8 | 10.522% | 2.524% | 8.120% |
| Three-class Otsu | 7/8 | 46.444% | 23.424% | 33.715% |
| Li | 7/8 | 122.667% | 70.899% | 81.378% |
| Fixed 0.10 | 4/8 | 13.995% | 4.187% | 12.511% |
| Fixed 0.12 | 0/8 | 0.000% | 0.000% | 5.188% |

Binary Otsu wins without a tie. Its improvement over fixed 0.10 does not establish generalization
or superiority to the fixed 0.12 comparison. The three outside-band images are A501, H1001,
and H501. These totals are uncertain calibration references, not independent biological labels.
An independent leave-one-out recomputation agrees with all eight saved subset winners: each
selects binary Otsu. This is a stress check using the same calibration images.

The separate 0.12 sensitivity review is material: A501 has 291 selected centers versus 333
at fixed 0.12, a 12.613% count decrease; H501 has 2456 versus 2950, a 16.746% decrease.
Their absolute center-count errors increase by 11.602 and 16.483 percentage points of H.
This is a documented regression requiring the global provisional reason. It does not trigger
a fixed-threshold fallback or an image-specific method choice using H.

Local threshold sensitivity measures a different quantity. Recomputed count changes at 0.9t
and 1.1t range from 2.405% to 7.258% for the chosen rule; none exceeds the frozen 10% gate.
The absence of `threshold_sensitive` on these eight results is therefore correct. Every chosen
result still carries `provisional_calibration`; local stability does not remove calibration bias.

## Numerical and boundary review

- Histogram fitting uses only positive finite raw response values, 256 equal-width bins,
  `f64` bin centers/counts/objectives, and the maximum in the final bin. Public preparation
  validates dimensions, RGBA length, diameter, k, and finite DoG response before selection.
- Binary Otsu scores two nonempty classes. Ascending splits and strict improvement retain
  the lowest split on an exact objective tie. The cutoff is the last low-class bin center.
- Li uses the histogram-weighted mean, at most 100 iterations, and the declared half-bin
  movement or unchanged-partition stop. Three-class Otsu uses its lower split. An unsuccessful
  research candidate records its reason and actual same-image binary-Otsu fallback method.
  No candidate fallback occurs on this corpus.
- Cutoffs round to five decimal places, floor at 0.00002, then become `f32`. The shared
  production detector compares inclusively with `>=`; its local-maximum and distance rules
  are reused unchanged. Sensitivity passes use the same rounding and minimum.
- Empty/uniform responses return empty centers and an explicit `no_signal` result. The actual
  Rust cutoff is above the response maximum and remains valid for manual preview/detection.
  Persist that numeric cutoff, including on no-signal results. A fabricated 0.10 or null cutoff
  would break the saved-result/overlay contract.
- Manual detection, the response probe, candidate evaluation, and selected detection use the
  same cached prepared response. Only one scale pair is cached and the previous response is
  released before replacement. No batch-wide threshold or prepared-image collection is added.
- The native core receives pixels and scalar detector settings. No filename, calibration ID,
  reference path, or total is available to the selector. The selected browser entry point
  hardcodes binary Otsu; it does not export a candidate-selection menu.

The three candidate implementations are justified native research support for reproducing the
experiment. Retain that evidence path. The production Wasm surface needs only the chosen rule;
additional candidate exports have no demonstrated product need.

## Evidence integrity and checks

Independently checked all 40 CSV count/cutoff/outside-loss rows, all eight per-image JSONs against
the aggregate JSON, all eight input JPEG hashes, center-array length and finiteness, and the
original snapshot's center coordinates against image bounds. Final count/cutoff arrays retain
the selected values above. Final manifest source hashes and the native binary hash match the
files on disk. Manifest, summary, and prediction digests agree.

The benchmark writes all eight inference records and the complete prediction file before it
opens references. It freezes source hashes before building and checks them again before the
reference join. Its renamed-copy receipt compares complete stable numerical outputs for A101.
The reference-injection receipt doubles every evaluation total and verifies that evaluation
changes while saved predictions remain unchanged. This is an evaluation-isolation check, not
a second native inference run using injected references.

Each native probe process handles one image and receives only an RGBA path and dimensions.
There is no cross-image native state that could select a different cutoff by input order.
The broader browser rename/order and native/Wasm parity checks remain assigned to M14-M15;
the present receipt does not claim they have already passed.

Executed successfully:

```bash
cargo test --manifest-path rust/Cargo.toml
cargo fmt --manifest-path rust/Cargo.toml --check
cargo clippy --manifest-path rust/Cargo.toml --all-targets -- -D warnings
source source_me.sh && python3 -m pyflakes devel/benchmark_automatic_methods.py
```

The 15 unit and two integration tests pass. Relevant tests cover lowest objective ties,
class splitting, lower multiclass selection, same-image fallback provenance, degenerate and
precision-limited responses, automatic/manual cutoff agreement, validation, and prepared-response
reuse across settings. This is sufficient for the native selection review; duplicate test
infrastructure is unnecessary.

Independently viewed the saved A501 and H501 center crops. They show selected centers on red
features, with weaker visible red features left unmarked. An 800-pixel crop is a limited visual
sanity check; it establishes neither full-image localization accuracy nor biological ground truth.

## Frozen evidence snapshot

Final experiment snapshot checked after the owner's last numerical rerun:

| Artifact | SHA-256 |
| --- | --- |
| `predictions.json` | `f86fd859ea083ff7c2006db66f32a435c242d021050b364b5ed0331e87d6979d` |
| `summary.json` | `f829bc36f0ca1da2d9a96c0e0ca32bbcf589249b69082136690ff7c7916094fd` |
| `evaluation.csv` | `fee97296a9f700c2e2e96b81035abf8163e6c0f0e1c3039a43f26ab5e0781174` |
| `manifest.json` | `89e633c959a0cfc7e9aa569ea692f9c7a28e55052b89da07c2911b79ccd52a55` |
| `rust/src/automatic_threshold.rs` | `1c4c66d12e2232a7ad0b26975bbbc77f738135c991e15647dd51858448f03ff9` |
| `rust/src/prepared_image.rs` | `5c63feaa1b0cb33154d78333573fbc6e0e1ba1f2576b69343db1ad35086f3ebe` |
| `rust/src/lib.rs` | `0e6927f66406234e996f0088c1990cb14b7036fbffdf4d3186501ad68b4bb84c` |
| `devel/benchmark_automatic_methods.py` | `decd282cbb41e11c7ba7d7a3f4549e286169654e4651cb1f4a5ea576b70e7ae3` |

The local `generated/automatic_threshold_experiment/manifest.json` records the
remaining source/input hashes, compiler version, native binary hash, and integrity receipts.
The [AUTOMATIC_DETECTOR_EXPERIMENT.md](../../AUTOMATIC_DETECTOR_EXPERIMENT.md) owns the durable
experiment description. Runtime timings change prediction-file hashes on reruns; the hashes here
identify this reviewed snapshot, not every future reproduction.
The owner's final report correctly records the final digest, manifest scope, 0.12 regressions,
provisional state, actual no-signal cutoff, native-only research candidates, and timing limits.

## Integration handoff

Continue the approved M5-M18 work with the chosen binary-Otsu rule. Preserve native method/version,
actual numeric cutoff, no-signal state, and review reasons in each image's result, overlay, and CSV.
The provisional reason must remain visible even when local sensitivity is low. Complete the
already-planned browser parity, batch recovery, result/export, and interaction evidence.

Verdict: Ship the selected native specification into the planned integration work.
Not checked: full benchmark rerun, browser parity/recovery/stress, final UI/export, or deployment.
Risk: calibration count bias remains; these eight images cannot establish biological accuracy.

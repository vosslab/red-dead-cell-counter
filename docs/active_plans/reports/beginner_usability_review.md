# Beginner workflow review

## Decision and scope

Verdict: ACCEPT. The narrow hover-contrast issue is corrected and the final built artifact passes
the responsive, keyboard, recovery, and measured accessibility checks within the scope below.

Independent expert cognitive walkthrough and measured browser accessibility review, performed
2026-11-12 against the canonical built app at `http://127.0.0.1:4193/`. This is M16 of
[automatic_image_counting_plan.md](../../archive/automatic_image_counting_plan.md), using
[beginner_task_model.md](beginner_task_model.md). No student participants or assistive-technology
users took part. No production, test, configuration, or Git index changes were made by this reviewer.

The target user is a biology student choosing local microscopy images, obtaining an automatic
count, checking its markers and uncertainty, and retaining a CSV. Local image selection waits for
`Count cells`; the explicitly described `Try an example` shortcut loads and counts A501 through
the same automatic pipeline. Single versus batch scope is inferred from the files. Manual counting
and DOE comparison belong to the selected image under collapsed `Advanced settings`.

## Artifact and evidence

- Initial canonical build: manager supplied Wasm SHA-256
  `a56984447184a7a2445e0b8eec7848a5855bf5b1fa35afff2d3925e71bfbdb59`.
- READY2 build: main SHA-256
  `fbfe0a63e3c5d2b1202a3158364806631bd5e8a75b91358ec98d4069614326ec`; worker SHA-256
  `013085b8cf2f0a92c2f1b9ffacea6f4eac37d2b5c28c798d7887af415733e7c6`.
- READY3 adds the hover correction; final stylesheet SHA-256
  `efe2d1472201f3e366c277f4fc3031c50a00b20630196d44a2cc93cc1e87c6cd`.
- Browser: headless Chromium `158.0.8127.18` through the installed Playwright package.
- Automated scanner: axe-core `4.14.0`, ephemeral npm cache under
  `/private/tmp/red_dead_cell_counter_npm_cache`; no production dependency was added.
- Review output: ignored root directory `output_beginner_review/`. JSON records contain collection
  timestamps, measured values, scanner findings, visible statuses, focus, and row contents.
- Screenshots: WebP quality 90, encoded from in-memory PNG buffers with `cwebp`. Reviewed the final
  320 px landing/result, 480 px result, 768 px selected, and 1920 px landing/result captures visually.

The initial matrix has 13 full-page captures: `{320,480,768,1920}_{initial,selected,result}.webp`
and `1920_advanced.webp`. Additional captures record recovery, manual counting, hover, and READY2
comparison states. These are disposable review receipts, rather than committed documentation images.

| Receipt | Content |
| --- | --- |
| `measurements.json` | Four widths, three states, initial/result axe scans, desktop Advanced scan |
| `keyboard.json` | Tab order, focus outlines, example timing, tab activation, target labels |
| `contrast.json` | Palette ratios and pixel-based primary hover contrast |
| `final_measurements.json` | Final 12-state layout matrix, nine axe scans, all-width hover retest |
| `walkthrough.json` | Partial failure, cancellation, retry, manual selected-image outcomes |
| `ready2_advanced.json` | Corrected-client full-image DOE completion and unchanged other row |
| `{320,480,768,1920}_counts.csv` | Same A501 result and provenance at every width |
| `batch_partial_failure.csv` | Completed row plus explicit failed-image row |
| `cancel_retains_completed.csv` | Completed row plus two cancelled rows |
| `retry_completes_batch.csv` | All three real images completed after retry |
| `manual_selected_only.csv` | Only the selected row changed to manual analysis |

## Walkthrough findings

The scenario starts from a fresh page with real local A501, H501, and E401 images. A corrupt JPEG
provides a controlled decode failure. Timings below measure automation/system completion on this
machine, not student task speed or biological accuracy.

| Step and action | Observed outcome | Result |
| --- | --- | --- |
| Start, press Tab | `Choose images` receives visible focus first; example is secondary | Pass |
| Press Enter, choose A501 | Native multiple-file chooser opens; workbench title receives focus | Pass |
| Inspect selected state | A501 is Pending, count is `--`, CSV disabled, next action explicitly Count | Pass |
| Tab from title twice | Choose images, then Count cells; no detector decisions intervene | Pass |
| Activate Count by keyboard | A501 completes in 1048-1096 ms across width runs; visible count 291 | Pass |
| Inspect result | Raw image has detection markers; explicit provisional calibration caveat visible | Pass |
| Download by keyboard | All four CSVs contain count 291, binary_otsu, automatic-dog-1, saved cutoff | Pass |
| Use example with Tab/Enter | Sample loads and counts 291 in 1186 ms; no local chooser required | Pass |
| Choose A501 plus corrupt JPEG | A501 291 retained; corrupt image failed with decode reason; CSV enabled | Pass |
| Retry failed set | Valid image completes again; corrupt image remains explicitly failed | Pass |
| Cancel after first of three | First saved count remains; other two become Cancelled; CSV retains rows | Pass |
| Retry same three files | A501 291, H501 2456, E401 480 complete; no completed row is lost | Pass |
| Select A501, manual threshold 0.5 | A501 becomes manual count 215; H501 2456 and E401 480 unchanged | Pass |
| READY2 selected A501 DOE, 15 runs | All 15 succeed in 6943 ms; representative manual 339 applied | Pass |
| Inspect nonselected H501 after DOE | Automatic H501 count remains 2456; DOE scope stays selected image | Pass |

CSV includes filename, dimensions, count, status/error, settings, method/version, analysis mode,
review reasons, and no-signal state. A501 exports `provisional_calibration`; the visible notice
states that eight calibration images still need independent validation. Completion is therefore
inspectable and exportable without representing the count as a validated biological truth.

## Responsive and accessibility results

At viewport height 1000 px, document scroll width equals viewport width in all 12
landing/selected/result combinations: 320, 480, 768, and 1920 px. Desktop Advanced also has no page
overflow. Deliberate image-viewport scrolling is separate from page overflow. The Western saloon,
poster, paper ledger, live text, and native controls remain legible and recognizable.

Axe reports zero violations in nine original and nine final scans: landing and populated result
at each of four widths, plus populated desktop Advanced. The final matrix has its own
`{320,480,768,1920}_final_{initial,selected,result}.webp` captures. This is not a claim of complete
WCAG conformance. Its contrast
rule returns manual-review items for gradients, texture, and complex shadows: 11 landing nodes,
25 result nodes, and 27 Advanced nodes. Empty comparison-table data and a generic comparison
feedback container also require manual interpretation; they do not obstruct the main task.

Contrast uses WCAG relative luminance. Hover measurement compares the original button screenshot
with a same-position screenshot whose text color is temporarily transparent, identifies solid
text pixels, and calculates contrast against their actual underlying gradient pixels. This avoids
using a gradient endpoint that never occurs behind the glyphs.

| Text or state | Measured ratio | Assessment |
| --- | --- | --- |
| Main paper text on dark background | 15.54:1 | Pass |
| Secondary instructional text on dark panel | 11.39:1 | Pass |
| Ordinary button, lightest wood endpoint | 7.47:1 | Pass |
| Ledger ink on paper | 11.78:1 | Pass |
| Done text on paper | 6.79:1 | Pass |
| Failure text on paper | 5.68:1 | Pass |
| Gold focus on light wood endpoint | 7.27:1 | Pass |
| Dark image-row focus on paper | 11.78:1 | Pass |
| Active Raw tab ink on gold | 11.44:1 | Pass |
| Primary hover text, 320 px, before correction | 4.39:1 | Fails 4.5:1 |
| Primary hover text, 480 / 1920 px | 4.83 / 4.74:1 | Pass |
| Corrected primary hover text, 320 / 480 px | 5.15 / 5.47:1 | Pass |
| Corrected primary hover text, 768 / 1920 px | 5.50 / 5.43:1 | Pass |

The narrow hover issue occurs because the 17.6 px bold label wraps onto two lines and the first
line reaches a lighter part of the gradient. It is normal-size text under WCAG; 3:1 does not apply.
The source location is the primary hover rule in [src/style.css](../../../src/style.css), lines
731-734 in the reviewed snapshot. The integration manager darkened its light endpoint from
`#c74734` to `#b53a2a`; all four actual glyph-background retests exceed 5:1. Final hover captures
are `{320,480,768,1920}_final_primary_hover.webp`. This reviewer does not modify production CSS.

Keyboard result order is Count, Download CSV, image row, Raw tab, Show detections, Zoom, Actual
pixels, Fit image, image viewport, Advanced. Focus outlines are persistent 3 px solid indicators;
image rows use dark ink on paper. ArrowRight moves focus from Raw to DoG without activation;
Enter activates the focused tab. Busy counting disables duplicate starts, leaves cancellation
available, preserves export of saved rows, and restores Count focus after completion/cancellation.

Explicit labels name the file picker, range, checkbox, controls, and inspection region. Status
and caveat text use live-region semantics. Marker and Zoom labels provide 44 px-high hit areas;
primary buttons and manual number inputs meet 44 px height. Browser forced-colors emulation
retains system-colored button text and borders. No full native screen-reader session was run.

One minor Advanced limitation remains: applying the representative DOE run disables the focused
Compare button temporarily, leaving focus on the document after application. Status and controls
remain usable. This does not block the beginner path and does not justify expanding this change.
At 320 px the Count table header wraps within its narrow column; the number, row, and status stay
readable and the page does not overflow.

## Guideline trace

| Task need | Guideline | Check and disposition |
| --- | --- | --- |
| Recognize the next action | About Face, progressive disclosure and excise | Remove entrance/mode decisions; Advanced collapsed; pass |
| Avoid initial parameter overload | Practical UI, progressive disclosure | Local choice reaches Count without expert controls; pass |
| Identify controls and their input | WCAG 3.3.2, labels or instructions | Visible native labels and explicit workflow instructions; pass |
| Detect waiting, completion, and errors | WCAG 4.1.3, status messages | Live status semantics and clear retained-row states; pass |
| Use keyboard and see location | WCAG 2.1.1 and 2.4.7 | File chooser, count, inspection, export, focus checks; pass |
| Read text in every state | WCAG 1.4.3, contrast minimum | Palette and corrected all-width primary hover pass |
| Recover without losing work | Task model, recognition and error recovery | Failure/cancel/retry receipts retain completed rows; pass |
| Judge uncertainty before saving | Visibility and match to real-world consequence | Visible calibration caveat matches exported review reason; pass |

Local About Face chapter 10, progressive disclosure, and Practical UI, page 61, progressive
disclosure, supplied the flow rationale. Their local-only corpus is not copied into the repo. The
HCI method-book path named by the skill is absent, so its topic index and walkthrough oracle were
used alongside these available books. Current primary accessibility references checked:
[W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html),
[W3C labels or instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html),
[W3C contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), and
[W3C focus visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html).

## Execution notes and limits

Commands run from the repository root include:

```bash
npm exec --cache=/private/tmp/red_dead_cell_counter_npm_cache --yes --package=axe-core -- node -e 'process.stdout.write("axe package cache ready\n")'
shasum -a 256 dist/main.js dist/worker.js dist/style.css
```

Browser inspection runs used `node --input-type=module` heredocs importing `chromium` from
`playwright`. The exact scan call was:

```javascript
await page.addScriptTag({
  path: "/private/tmp/red_dead_cell_counter_npm_cache/_npx/308f87df00af8a80/node_modules/axe-core/axe.min.js",
});
await page.evaluate(async () => {
  const result = await axe.run(document, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
    },
  });
  return { violations: result.violations, incomplete: result.incomplete };
});
```

Screenshots used `page.screenshot({ type: "png", fullPage: true })` and
`cwebp -quiet -q 90 -o output_beginner_review/<state>.webp -- -` with the PNG supplied on stdin.
Color pixel extraction used `magick png:- -depth 8 rgb:-`; the underlying-background capture
temporarily set the reviewed button's text color to transparent, then restored it.

The first sandboxed Chromium launch failed on macOS Mach bootstrap permissions; the authorized
browser inspection was rerun outside that sandbox. The default npm cache was unwritable; an
ephemeral `/private/tmp` cache avoided any ownership or repository dependency changes. An initial
matrix run stopped at an ambiguous nested-summary selector; its complete replacement uses
`#advanced-settings > summary` and saves results after each state. An initial-artifact DOE wait
timed out at 120 seconds; READY2, containing the separately repaired worker/client behavior,
completed the same full-image 15-run comparison in 6.9 seconds.

Permanent browser tests exist in [counter.spec.ts](../../../tests/playwright/counter.spec.ts) for
picker entry, the example, result/CSV provenance, corrupt images, cancellation, retry, and view-tab
behavior. This reviewer inspected those cases and ran the one-time independent browser checks;
the manager owns the full regression receipt. No permanent tests were added for these disposable
inspection measurements.

Not checked: native VoiceOver output, real touch hardware, Firefox/WebKit, recruited student
performance, or independent biological accuracy. Timing is local automation evidence. Focus and
forced-color checks establish browser behavior, not complete assistive-technology compatibility.

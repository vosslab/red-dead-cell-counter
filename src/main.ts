import { elements } from "./counter_elements.js";
import { createCounterController } from "./counter_controller.js";

function main(): void {
  const counter = createCounterController();
  elements.enter.addEventListener("click", function enterSaloon(): void {
    elements.gate.hidden = true;
    elements.counter.hidden = false;
    elements.counterTitle.focus();
  });
  elements.enter.disabled = false;
  elements.images.addEventListener("change", counter.choose);
  elements.analyze.addEventListener("click", function start(): void {
    void counter.analyze();
  });
  elements.analyzeSelected.addEventListener("click", function startSelected(): void {
    void counter.analyzeSelected();
  });
  elements.compare.addEventListener("click", function startComparison(): void {
    void counter.compareSettings();
  });
  elements.autoTuneBatch.addEventListener("click", function startAutoTuneBatch(): void {
    void counter.autoTuneAndAnalyzeBatch();
  });
  elements.cancel.addEventListener("click", counter.cancel);
  elements.comparisonCancel.addEventListener("click", function cancelComparison(): void {
    elements.cancel.click();
  });
  elements.download.addEventListener("click", counter.download);
  elements.inspectApplied.addEventListener("click", counter.inspectApplied);
  elements.markers.addEventListener("change", counter.redraw);
  for (const control of [elements.diameter, elements.k, elements.threshold])
    control.addEventListener("input", counter.settingsChanged);
}

main();

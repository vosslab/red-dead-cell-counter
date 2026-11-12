import { elements } from "./counter_elements.js";
import { createCounterController } from "./counter_controller.js";

function main(): void {
  const counter = createCounterController();
  for (const button of [elements.chooseImages, elements.chooseMoreImages])
    button.addEventListener("click", function chooseImages(): void {
      elements.images.click();
    });
  elements.images.addEventListener("change", function choose(): void {
    void counter.choose();
  });
  elements.tryExample.addEventListener("click", function tryExample(): void {
    void counter.tryExample();
  });
  elements.analyze.addEventListener("click", function start(): void {
    void counter.analyze();
  });
  elements.analyzeSelected.addEventListener("click", function startSelected(): void {
    void counter.analyzeSelected();
  });
  elements.compare.addEventListener("click", function startComparison(): void {
    void counter.compareSettings();
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

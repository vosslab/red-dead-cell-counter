import { elements } from "./counter_elements.js";
import { roundSettings, type DetectorSettings as Settings } from "./experiment_design.js";

export function settings(): Settings {
  return {
    diameter: Number(elements.diameter.value),
    k: Number(elements.k.value),
    threshold: Number(elements.threshold.value),
  };
}

export function processedSettings(): Settings | undefined {
  const requested = settings();
  if (!validate(requested)) return undefined;
  const actual = roundSettings(requested);
  if (!validate(actual) || actual.threshold <= 0.00001) return undefined;
  elements.diameter.value = actual.diameter.toFixed(2);
  elements.k.value = actual.k.toFixed(2);
  elements.threshold.value = actual.threshold.toFixed(5);
  return actual;
}

export function settingsValidationMessage(): string {
  const requested = settings();
  const rounded = roundSettings(requested);
  if (requested.threshold > 0.00001 && rounded.threshold <= 0.00001) {
    return "After rounding to five decimals, the threshold must remain above 0.00001.";
  }
  return "Use a diameter of 2-200 px, k of 1.1-8, and a threshold above 0.00001.";
}

export function validate(input: Settings | undefined): input is Settings {
  return (
    input !== undefined &&
    Number.isFinite(input.diameter) &&
    input.diameter >= 2 &&
    input.diameter <= 200 &&
    Number.isFinite(input.k) &&
    input.k >= 1.1 &&
    input.k <= 8 &&
    Number.isFinite(input.threshold) &&
    input.threshold > 0.00001
  );
}

export function comparisonSettingsText(input: Settings): string {
  return `diameter ${input.diameter.toFixed(2)} px, k ${input.k.toFixed(2)}, threshold ${input.threshold.toFixed(5)}`;
}

export type Workflow = "single" | "batch";

type WorkflowModes = {
  isBatch: () => boolean;
  select: (workflow: Workflow) => void;
  setBusy: (busy: boolean) => void;
};

export function createWorkflowModes(onChange: () => void): WorkflowModes {
  const counter = document.querySelector<HTMLElement>("#counter")!;
  const single = document.querySelector<HTMLInputElement>("#single-mode")!;
  const batch = document.querySelector<HTMLInputElement>("#batch-mode")!;
  const images = document.querySelector<HTMLInputElement>("#images")!;
  const picker = document.querySelector<HTMLElement>("#file-picker-label")!;
  const tuning = document.querySelector<HTMLElement>("#tuning-step")!;
  const help = document.querySelector<HTMLElement>("#workflow-help")!;
  const useBatch = document.querySelector<HTMLButtonElement>("#use-batch-settings")!;
  const tuneSelected = document.querySelector<HTMLButtonElement>("#tune-selected")!;
  let workflow: Workflow = "single";
  let busy = false;

  function render(): void {
    counter.dataset.workflow = workflow;
    single.checked = workflow === "single";
    batch.checked = workflow === "batch";
    images.multiple = workflow === "batch";
    picker.textContent = workflow === "batch" ? "Choose images" : "Choose image";
    tuning.textContent = workflow === "batch" ? "2. Batch settings" : "2. Tune and inspect";
    help.textContent =
      workflow === "batch"
        ? "Count all selected images with shared settings, then export the ledger."
        : "Tune, inspect, and count one selected image.";
    for (const item of document.querySelectorAll<HTMLElement>("[data-workflow-only]")) {
      item.hidden = item.dataset.workflowOnly !== workflow;
    }
    single.disabled = busy;
    batch.disabled = busy;
    useBatch.disabled = busy || images.files === null || images.files.length === 0;
    tuneSelected.disabled = busy || images.files === null || images.files.length === 0;
  }
  function select(next: Workflow): void {
    workflow = next;
    render();
    onChange();
  }
  single.addEventListener("change", function switchToSingle(): void {
    if (single.checked) select("single");
  });
  batch.addEventListener("change", function switchToBatch(): void {
    if (batch.checked) select("batch");
  });
  images.addEventListener("change", render);
  useBatch.addEventListener("click", function handoffToBatch(): void {
    select("batch");
    batch.focus();
  });
  tuneSelected.addEventListener("click", function handoffToSingle(): void {
    select("single");
    single.focus();
  });
  render();
  return {
    isBatch: (): boolean => workflow === "batch",
    select,
    setBusy(nextBusy: boolean): void {
      busy = nextBusy;
      render();
    },
  };
}

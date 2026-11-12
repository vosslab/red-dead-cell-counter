export type ViewerSettings = { diameter: number; k: number; threshold: number };
export type ViewerOverlay = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) => void;
type ViewKind = "raw" | "dog" | "threshold";
type Projection = {
  file: File;
  settings: ViewerSettings;
  dogImage: Uint8Array;
  thresholdImage: Uint8Array;
  width: number;
  height: number;
};
type ViewerElements = {
  canvas: HTMLCanvasElement;
  emptyImage: HTMLElement;
  tabs: HTMLElement;
  caption: HTMLElement;
  updateZoom: () => void;
  setStatus: (message: string) => void;
};

function sameSettings(first: ViewerSettings, second: ViewerSettings): boolean {
  return (
    first.diameter === second.diameter &&
    first.k === second.k &&
    first.threshold === second.threshold
  );
}

function settingsText(settings: ViewerSettings): string {
  return `diameter ${settings.diameter.toFixed(2)} px, k ${settings.k.toFixed(2)}, threshold ${settings.threshold.toFixed(5)}`;
}

export function createImageViewer(elements: ViewerElements): {
  show: (file: File, settings: ViewerSettings | undefined, overlay: ViewerOverlay) => Promise<void>;
  invalidate: () => void;
  clear: () => void;
  setBusy: (busy: boolean) => void;
} {
  let view: ViewKind = "raw";
  let projection: Projection | undefined;
  let displayedFile: File | undefined;
  let token = 0;
  let previewWorker: Worker | undefined;
  let pendingPreviewReject: ((reason: Error) => void) | undefined;
  let currentSettings: ViewerSettings | undefined;
  let currentOverlay: ViewerOverlay | undefined;
  let busy = false;
  const viewport = elements.canvas.parentElement!;
  let drag: { pointerId: number; x: number; y: number; left: number; top: number } | undefined;

  function endPan(): void {
    const pointerId = drag?.pointerId;
    drag = undefined;
    viewport.classList.remove("panning");
    if (pointerId !== undefined && elements.canvas.hasPointerCapture(pointerId))
      elements.canvas.releasePointerCapture(pointerId);
  }
  elements.canvas.addEventListener("pointerdown", function startPan(event: PointerEvent): void {
    // Touch keeps the browser's native scrolling and pinch gestures.
    if (event.button !== 0 || event.pointerType === "touch" || drag) return;
    if (
      viewport.scrollWidth <= viewport.clientWidth &&
      viewport.scrollHeight <= viewport.clientHeight
    )
      return;
    event.preventDefault();
    viewport.focus({ preventScroll: true });
    drag = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
    };
    elements.canvas.setPointerCapture(event.pointerId);
    viewport.classList.add("panning");
  });
  elements.canvas.addEventListener("pointermove", function movePan(event: PointerEvent): void {
    if (!drag || event.pointerId !== drag.pointerId) return;
    viewport.scrollLeft = drag.left + drag.x - event.clientX;
    viewport.scrollTop = drag.top + drag.y - event.clientY;
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"] as const) {
    elements.canvas.addEventListener(type, function stopPan(event: PointerEvent): void {
      if (event.pointerId === drag?.pointerId) endPan();
    });
  }
  window.addEventListener("blur", endPan);

  function tabButtons(): HTMLButtonElement[] {
    return Array.from(elements.tabs.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  }
  function selectTab(next: ViewKind): void {
    view = next;
    for (const button of tabButtons()) {
      const selected = button.dataset.view === view;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
      if (selected) {
        document
          .querySelector<HTMLElement>("#image-view-panel")
          ?.setAttribute("aria-labelledby", button.id);
      }
    }
  }
  function cancelPreview(): void {
    token += 1;
    previewWorker?.terminate();
    previewWorker = undefined;
    pendingPreviewReject?.(new Error("Preview cancelled."));
    pendingPreviewReject = undefined;
  }
  function drawPlane(plane: Uint8Array, width: number, height: number): void {
    const image = new ImageData(width, height);
    for (let index = 0; index < plane.length; index += 1) {
      const value = plane[index] ?? 0;
      const output = index * 4;
      image.data[output] = value;
      image.data[output + 1] = value;
      image.data[output + 2] = value;
      image.data[output + 3] = 255;
    }
    const context = elements.canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable.");
    context.putImageData(image, 0, 0);
  }
  function drawProjection(): void {
    if (!projection || !currentOverlay) return;
    elements.canvas.width = projection.width;
    elements.canvas.height = projection.height;
    drawPlane(
      view === "dog" ? projection.dogImage : projection.thresholdImage,
      projection.width,
      projection.height,
    );
    currentOverlay(elements.canvas.getContext("2d")!, projection.width, projection.height);
    elements.caption.textContent = `${view === "dog" ? "DoG response, contrast-stretched for display" : "Binary threshold: raw DoG response at or above cutoff"}. ${settingsText(projection.settings)}.`;
    elements.emptyImage.hidden = true;
    elements.canvas.hidden = false;
    elements.updateZoom();
  }
  async function drawRaw(file: File, currentToken: number): Promise<void> {
    const bitmap = await createImageBitmap(file);
    if (currentToken !== token) {
      bitmap.close();
      return;
    }
    if (bitmap.width * bitmap.height > 40_000_000) {
      bitmap.close();
      throw new Error("Images larger than 40 megapixels are not supported.");
    }
    elements.canvas.width = bitmap.width;
    elements.canvas.height = bitmap.height;
    const context = elements.canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      throw new Error("Canvas is unavailable.");
    }
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    currentOverlay?.(context, elements.canvas.width, elements.canvas.height);
    elements.caption.textContent = "Raw original RGB image.";
    elements.emptyImage.hidden = true;
    elements.canvas.hidden = false;
    elements.updateZoom();
  }
  async function createProjection(
    file: File,
    settings: ViewerSettings,
    currentToken: number,
  ): Promise<void> {
    elements.caption.textContent = `Loading ${view === "dog" ? "DoG response" : "threshold"}...`;
    const bitmap = await createImageBitmap(file);
    if (currentToken !== token) {
      bitmap.close();
      return;
    }
    if (bitmap.width * bitmap.height > 40_000_000) {
      bitmap.close();
      throw new Error("Images larger than 40 megapixels are not supported.");
    }
    const source = document.createElement("canvas");
    source.width = bitmap.width;
    source.height = bitmap.height;
    const context = source.getContext("2d", { willReadFrequently: true });
    if (!context) {
      bitmap.close();
      throw new Error("Canvas is unavailable.");
    }
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const rgba = context.getImageData(0, 0, source.width, source.height).data;
    const requestId = currentToken;
    const requestWorker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    previewWorker = requestWorker;
    let reply: PreviewWorkerReply;
    try {
      reply = await new Promise<PreviewWorkerReply>(function waitForPreview(resolve, reject): void {
        function receive(event: MessageEvent<PreviewWorkerReply>): void {
          if (event.data.kind === "preview" && event.data.id === requestId) {
            pendingPreviewReject = undefined;
            resolve(event.data);
          }
        }
        function failed(): void {
          pendingPreviewReject = undefined;
          reject(new Error("Preview processing failed."));
        }
        pendingPreviewReject = reject;
        requestWorker.addEventListener("message", receive, { once: true });
        requestWorker.addEventListener("error", failed, { once: true });
        const request: PreviewWorkerRequest = {
          kind: "preview",
          id: requestId,
          rgba: rgba.buffer,
          width: source.width,
          height: source.height,
          ...settings,
        };
        requestWorker.postMessage(request, [rgba.buffer]);
      });
    } finally {
      requestWorker.terminate();
      if (previewWorker === requestWorker) previewWorker = undefined;
    }
    if (currentToken !== token) return;
    if (!reply.ok) throw new Error(reply.error);
    projection = {
      file,
      settings,
      dogImage: reply.dogImage,
      thresholdImage: reply.thresholdImage,
      width: source.width,
      height: source.height,
    };
    drawProjection();
  }
  async function render(): Promise<void> {
    const file = displayedFile;
    const settings = currentSettings;
    if (!file) return;
    cancelPreview();
    const renderToken = token;
    try {
      if (view === "raw") await drawRaw(file, renderToken);
      else if (!settings) elements.setStatus("Use valid settings before viewing a derived image.");
      else if (projection?.file === file && sameSettings(projection.settings, settings))
        drawProjection();
      else await createProjection(file, settings, renderToken);
    } catch (error: unknown) {
      if (renderToken === token) {
        const message = error instanceof Error ? error.message : "Preview failed.";
        elements.canvas.hidden = true;
        elements.caption.textContent = "Preview unavailable.";
        elements.setStatus(message);
      }
    }
  }
  function activate(button: HTMLButtonElement): void {
    const next = button.dataset.view as ViewKind | undefined;
    if (!next || next === view) return;
    selectTab(next);
    void render();
  }
  elements.tabs.addEventListener("click", function selectView(event: MouseEvent): void {
    const button = (event.target as Element).closest<HTMLButtonElement>('[role="tab"]');
    if (button && !button.disabled) activate(button);
  });
  elements.tabs.addEventListener("keydown", function moveTab(event: KeyboardEvent): void {
    const buttons = tabButtons().filter(function enabled(button: HTMLButtonElement): boolean {
      return !button.disabled;
    });
    const current = event.target as HTMLButtonElement;
    const index = buttons.indexOf(current);
    if (index < 0 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : buttons.length - 1)) % buttons.length;
    const next = buttons[nextIndex];
    if (next) {
      next.focus();
    }
  });
  elements.tabs.addEventListener(
    "keydown",
    function activateFocusedTab(event: KeyboardEvent): void {
      if (event.key !== "Enter" && event.key !== " ") return;
      const button = event.target as HTMLButtonElement;
      if (button.matches('[role="tab"]') && !button.disabled) {
        event.preventDefault();
        activate(button);
      }
    },
  );
  return {
    async show(
      file: File,
      settings: ViewerSettings | undefined,
      overlay: ViewerOverlay,
    ): Promise<void> {
      const newFile = displayedFile !== file;
      displayedFile = file;
      currentSettings = settings;
      currentOverlay = overlay;
      for (const button of tabButtons()) {
        if (button.dataset.view !== "raw") button.disabled = busy || !settings;
      }
      if (newFile) {
        endPan();
        elements.canvas.hidden = true;
        elements.caption.textContent = "Loading image...";
        projection = undefined;
        selectTab("raw");
      }
      await render();
    },
    invalidate(): void {
      projection = undefined;
      cancelPreview();
      selectTab("raw");
    },
    clear(): void {
      endPan();
      projection = undefined;
      displayedFile = undefined;
      currentSettings = undefined;
      currentOverlay = undefined;
      cancelPreview();
      selectTab("raw");
      for (const button of tabButtons()) {
        if (button.dataset.view !== "raw") button.disabled = true;
      }
    },
    setBusy(running: boolean): void {
      busy = running;
      for (const button of tabButtons()) {
        if (button.dataset.view !== "raw") button.disabled = busy || !currentSettings;
      }
      if (busy && view !== "raw") {
        selectTab("raw");
        void render();
      }
    },
  };
}
import type { PreviewWorkerReply, PreviewWorkerRequest } from "./analysis_types.js";

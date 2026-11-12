import type {
  AutomaticWorkerReply,
  AutomaticWorkerRequest,
  DetectWorkerReply,
  DetectWorkerRequest,
  MeasureWorkerReply,
  MeasureWorkerRequest,
} from "./analysis_types.js";
import type { DetectorSettings } from "./experiment_design.js";

export async function decoded(file: File): Promise<ImageBitmap> {
  const bitmap = await createImageBitmap(file);
  if (bitmap.width * bitmap.height > 40_000_000) {
    bitmap.close();
    throw new Error("Images larger than 40 megapixels are not supported.");
  }
  return bitmap;
}

export async function pixels(
  file: File,
): Promise<{ rgba: Uint8ClampedArray<ArrayBuffer>; width: number; height: number }> {
  const bitmap = await decoded(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas is unavailable.");
    context.drawImage(bitmap, 0, 0);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    return { rgba: image.data, width: canvas.width, height: canvas.height };
  } finally {
    bitmap.close();
  }
}

export function createDetectorClient(): {
  start: () => void;
  finish: () => void;
  cancel: () => void;
  process: (
    id: number,
    rgba: Uint8ClampedArray<ArrayBuffer> | undefined,
    width: number,
    height: number,
    input: DetectorSettings,
  ) => Promise<DetectWorkerReply>;
  processAutomatic: (
    id: number,
    rgba: Uint8ClampedArray<ArrayBuffer>,
    width: number,
    height: number,
    input: Pick<DetectorSettings, "diameter" | "k">,
  ) => Promise<AutomaticWorkerReply>;
  processMeasurements: (
    id: number,
    width: number,
    height: number,
    input: DetectorSettings,
    centers: Float32Array,
  ) => Promise<MeasureWorkerReply>;
} {
  let worker: Worker | undefined;
  let pendingAbort: ((reason: Error) => void) | undefined;

  function stop(reason: Error): void {
    pendingAbort?.(reason);
    worker?.terminate();
    worker = undefined;
  }

  function finish(): void {
    stop(new Error("Detector worker stopped."));
  }

  function processRequest(request: AutomaticWorkerRequest): Promise<AutomaticWorkerReply>;
  function processRequest(request: DetectWorkerRequest): Promise<DetectWorkerReply>;
  function processRequest(request: MeasureWorkerRequest): Promise<MeasureWorkerReply>;
  function processRequest(
    request: AutomaticWorkerRequest | DetectWorkerRequest | MeasureWorkerRequest,
  ): Promise<AutomaticWorkerReply | DetectWorkerReply | MeasureWorkerReply> {
    const currentWorker = worker;
    if (!currentWorker) return Promise.reject(new Error("Detector worker is not running."));
    const activeWorker: Worker = currentWorker;
    if (pendingAbort) return Promise.reject(new Error("Detector worker is already processing."));
    return new Promise(function waitForResult(resolve, reject): void {
      function receive(
        event: MessageEvent<AutomaticWorkerReply | DetectWorkerReply | MeasureWorkerReply>,
      ): void {
        if (event.data.id !== request.id || event.data.kind !== request.kind) return;
        cleanup();
        resolve(event.data);
      }
      function failed(): void {
        abort(new Error(`${request.kind} worker processing failed.`));
      }
      function cleanup(): void {
        activeWorker.removeEventListener("message", receive);
        activeWorker.removeEventListener("error", failed);
        activeWorker.removeEventListener("messageerror", failed);
        pendingAbort = undefined;
      }
      function abort(reason: Error): void {
        cleanup();
        reject(reason);
      }
      activeWorker.addEventListener("message", receive);
      activeWorker.addEventListener("error", failed);
      activeWorker.addEventListener("messageerror", failed);
      pendingAbort = abort;
      try {
        const transfers =
          request.kind === "measure"
            ? [request.centers.buffer]
            : request.rgba
              ? [request.rgba]
              : [];
        activeWorker.postMessage(request, transfers);
      } catch (error: unknown) {
        abort(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  return {
    start(): void {
      finish();
      worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    },
    finish,
    cancel(): void {
      stop(new Error("Batch cancelled."));
    },
    process(id, rgba, width, height, input): Promise<DetectWorkerReply> {
      return processRequest({
        kind: "detect",
        id,
        rgba: rgba?.buffer,
        width,
        height,
        diameter: input.diameter,
        k: input.k,
        threshold: input.threshold,
      });
    },
    processAutomatic(id, rgba, width, height, input): Promise<AutomaticWorkerReply> {
      return processRequest({
        kind: "automatic",
        id,
        rgba: rgba.buffer,
        width,
        height,
        diameter: input.diameter,
        k: input.k,
      });
    },
    processMeasurements(id, width, height, input, centers): Promise<MeasureWorkerReply> {
      return processRequest({
        kind: "measure",
        id,
        width,
        height,
        diameter: input.diameter,
        k: input.k,
        threshold: input.threshold,
        centers: centers.slice(),
      });
    },
  };
}

import type { DetectorSettings } from "./experiment_design.js";

export type WorkerReply = { id: number; centers?: Float32Array; error?: string };

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
): Promise<{ rgba: Uint8ClampedArray; width: number; height: number }> {
  const bitmap = await decoded(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error("Canvas is unavailable.");
  }
  context.drawImage(bitmap, 0, 0);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { rgba: image.data, width: canvas.width, height: canvas.height };
}

export function createDetectorClient(): {
  start: () => void;
  finish: () => void;
  cancel: () => void;
  process: (
    id: number,
    rgba: Uint8ClampedArray | undefined,
    width: number,
    height: number,
    input: DetectorSettings,
  ) => Promise<WorkerReply>;
} {
  let worker: Worker | undefined;
  let pendingReject: ((reason: Error) => void) | undefined;

  function finish(): void {
    worker?.terminate();
    worker = undefined;
  }

  return {
    start(): void {
      finish();
      worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    },
    finish,
    cancel(): void {
      finish();
      pendingReject?.(new Error("Batch cancelled."));
      pendingReject = undefined;
    },
    process(
      id: number,
      rgba: Uint8ClampedArray | undefined,
      width: number,
      height: number,
      input: DetectorSettings,
    ): Promise<WorkerReply> {
      const currentWorker = worker;
      if (!currentWorker) return Promise.reject(new Error("Detector worker is not running."));
      const activeWorker: Worker = currentWorker;
      return new Promise(function waitForResult(
        resolve: (reply: WorkerReply) => void,
        reject: (reason: Error) => void,
      ): void {
        function receive(event: MessageEvent<WorkerReply>): void {
          if (event.data.id === id) {
            cleanup();
            resolve(event.data);
          }
        }
        function failed(): void {
          cleanup();
          reject(new Error("Worker processing failed."));
        }
        function cleanup(): void {
          activeWorker.removeEventListener("message", receive);
          activeWorker.removeEventListener("error", failed);
          pendingReject = undefined;
        }
        activeWorker.addEventListener("message", receive);
        activeWorker.addEventListener("error", failed, { once: true });
        pendingReject = reject;
        activeWorker.postMessage(
          { id, rgba: rgba?.buffer, width, height, ...input },
          rgba ? [rgba.buffer] : [],
        );
      });
    },
  };
}

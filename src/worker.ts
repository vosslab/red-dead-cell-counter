/// <reference lib="webworker" />
import init, { PreparedImage, measure_blobs, preview } from "../rust/pkg/cell_detector.js";
import type { WorkerReply, WorkerRequest } from "./analysis_types.js";

const ready = init({ module_or_path: new URL("./wasm/cell_detector_bg.wasm", import.meta.url) });
let prepared: { image: PreparedImage; width: number; height: number } | undefined;

function validateDimensions(width: number, height: number): number {
  const pixels = width * height;
  // ASVS 2.2.1/1.4.2: reject coercion and bound allocations before entering Wasm.
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    pixels > 40_000_000
  )
    throw new Error("Image dimensions must contain 1 to 40,000,000 pixels.");
  return pixels;
}

function validatePixels(buffer: ArrayBuffer | undefined, pixels: number, channels: number): void {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength !== pixels * channels)
    throw new Error(
      `${channels === 4 ? "RGBA" : "Mask"} buffer length must match image dimensions.`,
    );
}

function prepare(rgba: ArrayBuffer, width: number, height: number): PreparedImage {
  const image = new PreparedImage(new Uint8Array(rgba), width, height);
  prepared = { image, width, height };
  return image;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>): Promise<void> => {
  const request = event.data;
  try {
    if (
      request.kind !== "automatic" &&
      request.kind !== "detect" &&
      request.kind !== "preview" &&
      request.kind !== "blobs"
    )
      throw new Error("Unknown worker request kind.");
    if (request.kind === "automatic" || (request.kind === "detect" && request.rgba !== undefined)) {
      // ASVS 1.4.3: a failed replacement must leave no reusable previous image.
      prepared?.image.free();
      prepared = undefined;
    }
    if (!Number.isSafeInteger(request.id)) throw new Error("Request id must be an integer.");
    const pixels = validateDimensions(request.width, request.height);
    await ready;
    if (request.kind === "blobs") {
      validatePixels(request.mask, pixels, 1);
      const blobFeatures = measure_blobs(
        new Uint8Array(request.mask),
        request.width,
        request.height,
      );
      const reply: WorkerReply = { id: request.id, kind: "blobs", ok: true, blobFeatures };
      self.postMessage(reply, { transfer: [blobFeatures.buffer] });
      return;
    }
    if (!Number.isFinite(request.diameter) || !Number.isFinite(request.k))
      throw new Error("Diameter and k must be finite numbers.");
    if (request.kind === "automatic") {
      validatePixels(request.rgba, pixels, 4);
      const image = prepare(request.rgba, request.width, request.height);
      const result = image.automatic(request.diameter, request.k);
      try {
        const centers = result.centers();
        const reply: WorkerReply = {
          id: request.id,
          kind: "automatic",
          ok: true,
          centers,
          analysis: {
            settings: {
              diameter: request.diameter,
              k: request.k,
              threshold: result.threshold(),
            },
            mode: "automatic",
            method: result.method(),
            version: result.version(),
            reviewReasons: result.review_reasons(),
            noSignal: result.no_signal(),
          },
        };
        self.postMessage(reply, { transfer: [centers.buffer] });
      } finally {
        result.free();
      }
      return;
    }
    if (!Number.isFinite(request.threshold)) throw new Error("Threshold must be a finite number.");
    if (request.kind === "preview") {
      validatePixels(request.rgba, pixels, 4);
      const packed = preview(
        new Uint8Array(request.rgba),
        request.width,
        request.height,
        request.diameter,
        request.k,
        request.threshold,
      );
      const dogImage = packed.subarray(0, pixels);
      const thresholdImage = packed.subarray(pixels);
      const reply: WorkerReply = {
        id: request.id,
        kind: "preview",
        ok: true,
        dogImage,
        thresholdImage,
      };
      self.postMessage(reply, { transfer: [packed.buffer] });
      return;
    }
    if (request.rgba !== undefined) {
      validatePixels(request.rgba, pixels, 4);
      prepare(request.rgba, request.width, request.height);
    }
    if (!prepared || prepared.width !== request.width || prepared.height !== request.height)
      throw new Error("No prepared image matches these dimensions; provide image pixels first.");
    const centers = prepared.image.detect(request.diameter, request.k, request.threshold);
    const reply: WorkerReply = { id: request.id, kind: "detect", ok: true, centers };
    self.postMessage(reply, { transfer: [centers.buffer] });
  } catch (error: unknown) {
    const reply = { id: request?.id, kind: request?.kind, ok: false, error: String(error) };
    self.postMessage(reply);
  }
};

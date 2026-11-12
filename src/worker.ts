/// <reference lib="webworker" />
import init, { PreparedImage, measure_blobs, preview } from "../rust/pkg/cell_detector.js";

type Request = {
  id: number;
  width: number;
  height: number;
} & (
  | { kind: "blobs"; mask: ArrayBuffer }
  | {
      kind?: "detect" | "preview";
      rgba?: ArrayBuffer;
      diameter: number;
      k: number;
      threshold: number;
    }
);

const ready = init({ module_or_path: new URL("./wasm/cell_detector_bg.wasm", import.meta.url) });
let prepared: { image: PreparedImage; width: number; height: number } | undefined;
self.onmessage = async (event: MessageEvent<Request>): Promise<void> => {
  const request = event.data;
  try {
    await ready;
    if (request.kind === "blobs") {
      if (!(request.mask instanceof ArrayBuffer)) throw new Error("Blobs require a binary mask.");
      const blobFeatures = measure_blobs(
        new Uint8Array(request.mask),
        request.width,
        request.height,
      );
      self.postMessage({ id: request.id, blobFeatures }, { transfer: [blobFeatures.buffer] });
      return;
    }
    if (request.kind === "preview") {
      if (!request.rgba) throw new Error("Preview requires image pixels.");
      const packed = preview(
        new Uint8Array(request.rgba),
        request.width,
        request.height,
        request.diameter,
        request.k,
        request.threshold,
      );
      const pixels = request.width * request.height;
      const dogImage = packed.subarray(0, pixels);
      const thresholdImage = packed.subarray(pixels);
      self.postMessage({ id: request.id, dogImage, thresholdImage }, { transfer: [packed.buffer] });
      return;
    }
    if (request.rgba) {
      prepared?.image.free();
      prepared = undefined;
      prepared = {
        image: new PreparedImage(new Uint8Array(request.rgba), request.width, request.height),
        width: request.width,
        height: request.height,
      };
    }
    if (!prepared || prepared.width !== request.width || prepared.height !== request.height)
      throw new Error("No prepared image matches these dimensions; provide image pixels first.");
    const centers = prepared.image.detect(request.diameter, request.k, request.threshold);
    self.postMessage({ id: request.id, centers }, { transfer: [centers.buffer] });
  } catch (error: unknown) {
    self.postMessage({ id: request.id, error: String(error) });
  }
};

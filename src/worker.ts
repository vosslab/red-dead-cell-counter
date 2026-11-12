/// <reference lib="webworker" />
import init, { PreparedImage, preview } from "../rust/pkg/cell_detector.js";

interface Request {
  id: number;
  kind?: "detect" | "preview";
  rgba?: ArrayBuffer;
  width: number;
  height: number;
  diameter: number;
  k: number;
  threshold: number;
}

const ready = init({ module_or_path: new URL("./wasm/cell_detector_bg.wasm", import.meta.url) });
let prepared: { image: PreparedImage; width: number; height: number } | undefined;
self.onmessage = async (event: MessageEvent<Request>): Promise<void> => {
  const request = event.data;
  try {
    await ready;
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

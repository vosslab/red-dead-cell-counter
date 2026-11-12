/// <reference lib="webworker" />
import init, { detect } from "../rust/pkg/cell_detector.js";

interface Request {
  id: number;
  rgba: ArrayBuffer;
  width: number;
  height: number;
  diameter: number;
  k: number;
  threshold: number;
}

const ready = init({ module_or_path: new URL("./wasm/cell_detector_bg.wasm", import.meta.url) });
self.onmessage = async (event: MessageEvent<Request>): Promise<void> => {
  const request = event.data;
  try {
    await ready;
    const centers = detect(
      new Uint8Array(request.rgba),
      request.width,
      request.height,
      request.diameter,
      request.k,
      request.threshold,
    );
    self.postMessage({ id: request.id, centers }, { transfer: [centers.buffer] });
  } catch (error: unknown) {
    self.postMessage({ id: request.id, error: String(error) });
  }
};

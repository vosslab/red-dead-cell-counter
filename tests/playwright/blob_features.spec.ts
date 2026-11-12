/// <reference types="node" />
import { expect, test } from "@playwright/test";

type BlobReply = { id: number; blobFeatures?: Float64Array; error?: string };

test("production worker measures 8-connected masks with defined shape features", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const worker = new Worker("worker.js", { type: "module" });
    const request = (
      id: number,
      mask: number[],
      width: number,
      height: number,
    ): Promise<BlobReply> =>
      new Promise((resolve) => {
        const receive = (event: MessageEvent<BlobReply>): void => {
          if (event.data.id !== id) return;
          worker.removeEventListener("message", receive);
          resolve(event.data);
        };
        worker.addEventListener("message", receive);
        const bytes = new Uint8Array(mask);
        worker.postMessage({ id, kind: "blobs", mask: bytes.buffer, width, height }, [
          bytes.buffer,
        ]);
      });
    const diagonal = await request(1, [1, 0, 0, 1], 2, 2);
    const square = await request(2, [1, 1, 1, 1], 2, 2);
    const invalid = await request(3, [1, 1, 1, 1], 3, 2);
    worker.terminate();
    return {
      typedPayload:
        diagonal.blobFeatures instanceof Float64Array &&
        square.blobFeatures instanceof Float64Array,
      diagonal: Array.from(diagonal.blobFeatures ?? []),
      diagonalError: diagonal.error,
      square: Array.from(square.blobFeatures ?? []),
      squareError: square.error,
      invalidError: invalid.error,
    };
  });
  expect(result.typedPayload).toBe(true);
  expect(result.diagonalError).toBeUndefined();
  expect(result.diagonal.slice(0, 5)).toEqual([0, 0, 2, 0.5, 0.5]);
  expect(result.diagonal[5]).toBeCloseTo(2 * Math.sqrt(2 / Math.PI), 12);
  expect(result.diagonal[6]).toBeCloseTo(Math.PI / 8, 12);
  expect(Number.isNaN(result.diagonal[7])).toBe(true);
  expect(result.squareError).toBeUndefined();
  expect(result.square.slice(0, 5)).toEqual([0, 0, 4, 0.5, 0.5]);
  expect(result.square[5]).toBeCloseTo(4 / Math.sqrt(Math.PI), 12);
  expect(result.square[6]).toBeCloseTo(Math.PI / 2, 12);
  expect(result.square[7]).toBe(1);
  expect(result.invalidError).toBeTruthy();
});

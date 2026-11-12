/// <reference types="node" />
import { expect, test } from "@playwright/test";

type WorkerReply = { id: number; ok: boolean; centers?: ArrayLike<number>; error?: string };

test("prepared worker image agrees with fresh detection and rejects stale image state", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const first = image(48, 40, [10, 10, 255], [27, 18, 190], [38, 30, 128]);
    const firstForFresh = first.slice();
    const second = image(48, 40, [13, 12, 255]);
    const third = image(32, 24, [16, 12, 255]);
    const worker = new Worker("worker.js", { type: "module" });
    const request = (input: Record<string, unknown>): Promise<WorkerReply> =>
      new Promise((resolve) => {
        const payload: Record<string, unknown> = { kind: "detect", ...input };
        const id = payload.id as number;
        const receive = (event: MessageEvent<WorkerReply>): void => {
          if (event.data.id !== id) return;
          worker.removeEventListener("message", receive);
          resolve(event.data);
        };
        worker.addEventListener("message", receive);
        const rgba = payload.rgba;
        if (rgba instanceof ArrayBuffer) worker.postMessage(payload, [rgba]);
        else worker.postMessage(payload);
      });
    const settings = { diameter: 8, k: 3, threshold: 0.01 };
    const initial = await request({
      id: 1,
      rgba: first.buffer,
      width: 48,
      height: 40,
      ...settings,
    });
    const reused = await request({ id: 2, width: 48, height: 40, ...settings, threshold: 0.00002 });
    const fresh = await request({
      id: 3,
      rgba: firstForFresh.buffer,
      width: 48,
      height: 40,
      ...settings,
      threshold: 0.00002,
    });
    const mismatch = await request({ id: 4, width: 32, height: 24, ...settings });
    const replacement = await request({
      id: 5,
      rgba: second.buffer,
      width: 48,
      height: 40,
      ...settings,
    });
    const resized = await request({
      id: 6,
      rgba: third.buffer,
      width: 32,
      height: 24,
      ...settings,
    });
    const invalidReplacement = await request({
      id: 7,
      rgba: new ArrayBuffer(3),
      width: 48,
      height: 40,
      ...settings,
    });
    const noStaleResult = await request({ id: 8, width: 32, height: 24, ...settings });
    worker.terminate();
    return {
      initial,
      reused,
      fresh,
      mismatch,
      replacement,
      resized,
      invalidReplacement,
      noStaleResult,
    };

    function image(
      width: number,
      height: number,
      ...spots: [number, number, number][]
    ): Uint8Array {
      const rgba = new Uint8Array(width * height * 4);
      for (const [centerX, centerY, red] of spots)
        for (let y = centerY - 3; y <= centerY + 3; y += 1)
          for (let x = centerX - 3; x <= centerX + 3; x += 1)
            if ((x - centerX) ** 2 + (y - centerY) ** 2 <= 9) rgba[(y * width + x) * 4] = red;
      return rgba;
    }
  });
  expect(result.initial.ok).toBe(true);
  expect(result.initial.error).toBeUndefined();
  expect(Array.from(result.initial.centers ?? [])).toEqual([10, 10, 27, 18, 38, 30]);
  expect(result.reused.error).toBeUndefined();
  expect(Array.from(result.reused.centers ?? [])).toEqual(Array.from(result.fresh.centers ?? []));
  expect(result.mismatch.ok).toBe(false);
  expect(result.mismatch.error).toContain("dimensions");
  expect(result.replacement.error).toBeUndefined();
  expect(Array.from(result.replacement.centers ?? [])).toEqual([13, 12]);
  expect(result.resized.error).toBeUndefined();
  expect(Array.from(result.resized.centers ?? [])).toEqual([16, 12]);
  expect(result.invalidReplacement.error).toContain("RGBA");
  expect(result.noStaleResult.error).toContain("prepared");
});

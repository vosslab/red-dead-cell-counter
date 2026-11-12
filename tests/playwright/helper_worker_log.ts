import type { Page } from "@playwright/test";
import type { SavedAnalysis, WorkerReply, WorkerRequest } from "../../src/analysis_types.js";

type AutomaticResult = { centers: number[]; analysis: SavedAnalysis };
export type Detection = {
  settings: { diameter: number; k: number; threshold: number };
  centers: number[];
};
export type RefinementLog = { seed: AutomaticResult; detections: Detection[] };
type WorkerLog = {
  results: AutomaticResult[];
  refinements: RefinementLog[];
  detections: Detection[];
  previews: { threshold: number; k: number }[];
};

export async function workerLog(page: Page): Promise<WorkerLog> {
  return page.evaluate(() => (window as unknown as { workerLog: WorkerLog }).workerLog);
}

export async function installWorkerLog(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log = {
      results: [] as AutomaticResult[],
      refinements: [] as RefinementLog[],
      detections: [] as Detection[],
      previews: [] as { threshold: number; k: number }[],
    };
    (window as unknown as { workerLog: WorkerLog }).workerLog = log;
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        const requests = new Map<number, WorkerRequest>();
        this.recordRequest = (request): void => {
          requests.set(request.id, request);
        };
        let refinement: RefinementLog | undefined;
        this.addEventListener("message", (event: MessageEvent<WorkerReply>) => {
          const reply = event.data;
          if (reply.kind === "automatic" && reply.ok) {
            const seed = { centers: Array.from(reply.centers), analysis: reply.analysis };
            log.results.push(seed);
            refinement = { seed, detections: [] };
            log.refinements.push(refinement);
          } else if (reply.kind === "detect" && reply.ok) {
            const request = requests.get(reply.id);
            if (request?.kind === "detect") {
              const detection = {
                settings: {
                  diameter: request.diameter,
                  k: request.k,
                  threshold: request.threshold,
                },
                centers: Array.from(reply.centers),
              };
              log.detections.push(detection);
              refinement?.detections.push(detection);
            }
          }
          requests.delete(reply.id);
        });
      }
      recordRequest: ((request: WorkerRequest) => void) | undefined;
      override postMessage(
        message: unknown,
        transferOrOptions?: Transferable[] | StructuredSerializeOptions,
      ): void {
        const request = message as WorkerRequest;
        this.recordRequest?.(request);
        if (request.kind === "preview")
          log.previews.push({ threshold: request.threshold, k: request.k });
        if (
          request.kind === "automatic" &&
          (window as unknown as { failAutomatic?: boolean }).failAutomatic
        ) {
          queueMicrotask(() =>
            this.dispatchEvent(
              new MessageEvent("message", {
                data: {
                  id: (message as { id: number }).id,
                  kind: "automatic",
                  ok: false,
                  error: "Injected worker failure",
                },
              }),
            ),
          );
          return;
        }
        if (Array.isArray(transferOrOptions)) super.postMessage(message, transferOrOptions);
        else super.postMessage(message, transferOrOptions);
      }
    };
  });
}

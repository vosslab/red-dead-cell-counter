import type { DetectorSettings } from "./experiment_design.js";

export type SavedAnalysis = Readonly<{
  settings: Readonly<DetectorSettings>;
  mode: "automatic" | "manual";
  method: string;
  version: string;
  reviewReasons: readonly string[];
  // Native no-signal results still supply the actual valid processing cutoff.
  noSignal: boolean;
}>;

type ImageRequest = { id: number; width: number; height: number };

export type AutomaticWorkerRequest = ImageRequest & {
  kind: "automatic";
  rgba: ArrayBuffer;
  diameter: number;
  k: number;
};

export type DetectWorkerRequest = ImageRequest &
  DetectorSettings & { kind: "detect"; rgba?: ArrayBuffer };

export type PreviewWorkerRequest = ImageRequest &
  DetectorSettings & { kind: "preview"; rgba: ArrayBuffer };

export type BlobWorkerRequest = ImageRequest & { kind: "blobs"; mask: ArrayBuffer };

export type WorkerRequest =
  AutomaticWorkerRequest | DetectWorkerRequest | PreviewWorkerRequest | BlobWorkerRequest;

type WorkerFailure<Kind extends WorkerRequest["kind"]> = {
  id: number;
  kind: Kind;
  ok: false;
  error: string;
};

export type AutomaticWorkerReply =
  | {
      id: number;
      kind: "automatic";
      ok: true;
      centers: Float32Array;
      analysis: SavedAnalysis;
    }
  | WorkerFailure<"automatic">;

export type DetectWorkerReply =
  { id: number; kind: "detect"; ok: true; centers: Float32Array } | WorkerFailure<"detect">;

export type PreviewWorkerReply =
  | {
      id: number;
      kind: "preview";
      ok: true;
      dogImage: Uint8Array;
      thresholdImage: Uint8Array;
    }
  | WorkerFailure<"preview">;

export type BlobWorkerReply =
  { id: number; kind: "blobs"; ok: true; blobFeatures: Float64Array } | WorkerFailure<"blobs">;

export type WorkerReply =
  AutomaticWorkerReply | DetectWorkerReply | PreviewWorkerReply | BlobWorkerReply;

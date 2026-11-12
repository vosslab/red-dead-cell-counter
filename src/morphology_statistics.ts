import { countStatistics } from "./count_statistics";
import type { CountStatistics } from "./count_statistics";
import type { MorphologyMeasurements, ObjectMeasurement } from "./morphology_types";

export type MorphologySummary = {
  objectCount: number;
  singleCenterCount: number;
  multiCenterCount: number;
  noCenterCount: number;
  edgeCount: number;
  eligibleCount: number;
  metrics: {
    areaPx?: CountStatistics;
    equivalentDiameterPx?: CountStatistics;
    roundness?: CountStatistics;
    inertiaRatio?: CountStatistics;
    meanSquaredRadiusPx2?: CountStatistics;
  };
};

function isEligible(object: ObjectMeasurement): boolean {
  return object.centerIndices.length === 1 && !object.touchesEdge;
}

export function summarizeMorphology(morphology: MorphologyMeasurements): MorphologySummary {
  const { objects } = morphology;
  // Single-center interior objects approximate cells without splitting cluster measurements.
  const eligible = objects.filter(isEligible);
  const summary: MorphologySummary = {
    objectCount: objects.length,
    singleCenterCount: objects.filter((object) => object.centerIndices.length === 1).length,
    multiCenterCount: objects.filter((object) => object.centerIndices.length > 1).length,
    noCenterCount: objects.filter((object) => object.centerIndices.length === 0).length,
    edgeCount: objects.filter((object) => object.touchesEdge).length,
    eligibleCount: eligible.length,
    metrics: {
      areaPx: countStatistics(eligible.map((object) => object.areaPx).filter(Number.isFinite)),
      equivalentDiameterPx: countStatistics(
        eligible.map((object) => object.equivalentDiameterPx).filter(Number.isFinite),
      ),
      roundness: countStatistics(
        eligible.map((object) => object.roundness).filter(Number.isFinite),
      ),
      inertiaRatio: countStatistics(
        eligible.map((object) => object.inertiaRatio).filter(Number.isFinite),
      ),
      meanSquaredRadiusPx2: countStatistics(
        eligible.map((object) => object.meanSquaredRadiusPx2).filter(Number.isFinite),
      ),
    },
  };
  return summary;
}

export type ChallengeExample = { title: string; object: ObjectMeasurement };

function rowMajor(first: ObjectMeasurement, second: ObjectMeasurement): number {
  return first.firstY - second.firstY || first.firstX - second.firstX;
}

function largestFirst(first: ObjectMeasurement, second: ObjectMeasurement): number {
  return second.areaPx - first.areaPx || rowMajor(first, second);
}

export function challengeExamples(morphology: MorphologyMeasurements): ChallengeExample[] {
  const examples: ChallengeExample[] = [];
  const anchors = new Set<string>();
  function select(title: string, candidates: ObjectMeasurement[]): void {
    const object = candidates.find(
      (candidate) => !anchors.has(`${candidate.firstX},${candidate.firstY}`),
    );
    if (!object || examples.length === 3) return;
    anchors.add(`${object.firstX},${object.firstY}`);
    examples.push({ title, object });
  }

  select(
    "Multiple centers in one object",
    morphology.objects
      .filter((object) => object.centerIndices.length > 1)
      .sort(
        (first, second) =>
          second.centerIndices.length - first.centerIndices.length || largestFirst(first, second),
      ),
  );
  const eligible = morphology.objects.filter(isEligible);
  select("Largest single-center object", [...eligible].sort(largestFirst));
  select(
    "Least round single-center object",
    [...eligible].sort(
      (first, second) => first.roundness - second.roundness || rowMajor(first, second),
    ),
  );
  select(
    "Object without a retained center",
    morphology.objects.filter((object) => object.centerIndices.length === 0).sort(largestFirst),
  );
  return examples;
}

export type ObjectMeasurement = Readonly<{
  firstX: number;
  firstY: number;
  areaPx: number;
  centroidX: number;
  centroidY: number;
  equivalentDiameterPx: number;
  roundness: number;
  inertiaRatio: number;
  meanSquaredRadiusPx2: number;
  bounds: readonly [xMin: number, yMin: number, xMaxExclusive: number, yMaxExclusive: number];
  touchesEdge: boolean;
  centerIndices: readonly number[];
}>;

export type MorphologyMeasurements = Readonly<{
  objects: readonly ObjectMeasurement[];
}>;

export function unpackMorphology(
  features: Float64Array,
  centerComponents: Uint32Array,
): MorphologyMeasurements {
  // ASVS 2.2.1: reject malformed native records before indexing them.
  if (features.length % 14 !== 0)
    throw new Error("Object measurement records must have 14 values.");
  const centerIndices: number[][] = Array.from({ length: features.length / 14 }, () => []);
  for (const [index, component] of centerComponents.entries()) {
    const indices = centerIndices[component];
    if (!indices) throw new Error("Center component index is outside object measurements.");
    indices.push(index);
  }
  const objects: ObjectMeasurement[] = [];
  for (let offset = 0; offset < features.length; offset += 14) {
    objects.push({
      firstX: features[offset]!,
      firstY: features[offset + 1]!,
      areaPx: features[offset + 2]!,
      centroidX: features[offset + 3]!,
      centroidY: features[offset + 4]!,
      equivalentDiameterPx: features[offset + 5]!,
      roundness: features[offset + 6]!,
      inertiaRatio: features[offset + 7]!,
      meanSquaredRadiusPx2: features[offset + 8]!,
      bounds: [
        features[offset + 9]!,
        features[offset + 10]!,
        features[offset + 11]!,
        features[offset + 12]!,
      ],
      touchesEdge: features[offset + 13] === 1,
      centerIndices: centerIndices[offset / 14]!,
    });
  }
  return { objects };
}

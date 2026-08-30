import { computeMeasurementFingerprint } from "./canonicalHash.js";
import { validateQuantitativeObservation } from "./validateObservation.js";

function contextKey(observation) {
  const context = observation.biologicalContext ?? {};
  return [
    context.spatialScope ?? "unknown",
    context.experimentalSetting ?? "unknown",
    context.matrix ?? "no-matrix",
    context.tissue ?? "no-tissue"
  ].join("|");
}

export async function buildCandidateReport(observations) {
  const entries = await Promise.all(observations.map(async (observation) => ({
    observation,
    validation: validateQuantitativeObservation(observation),
    fingerprint: await computeMeasurementFingerprint(observation),
    contextKey: contextKey(observation)
  })));

  const identities = new Map();
  for (const entry of entries) {
    const id = entry.observation.observationId;
    if (!identities.has(id)) identities.set(id, new Set());
    identities.get(id).add(entry.fingerprint);
  }
  const conflictingIds = new Set(
    [...identities.entries()].filter(([, fingerprints]) => fingerprints.size > 1).map(([id]) => id)
  );

  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.contextKey)) {
      const context = entry.observation.biologicalContext ?? {};
      groups.set(entry.contextKey, {
        spatialScope: context.spatialScope ?? "unknown",
        experimentalSetting: context.experimentalSetting ?? "unknown",
        matrix: context.matrix ?? null,
        tissue: context.tissue ?? null,
        observationIds: []
      });
    }
    groups.get(entry.contextKey).observationIds.push(entry.observation.observationId);
  }

  const comparisons = new Map();
  for (const entry of entries) {
    const comparisonId = entry.observation.experiment?.comparisonId;
    if (!comparisonId) continue;
    if (!comparisons.has(comparisonId)) comparisons.set(comparisonId, []);
    comparisons.get(comparisonId).push(entry);
  }
  const crossContextComparisons = [...comparisons.entries()]
    .filter(([, compared]) => compared.length > 1 && new Set(compared.map((entry) => entry.contextKey)).size > 1)
    .map(([comparisonId, compared]) => ({
      comparisonId,
      observationIds: compared.map((entry) => entry.observation.observationId)
    }));

  const eligibleCount = entries.filter((entry) => (
    entry.validation.calibrationEligible && !conflictingIds.has(entry.observation.observationId)
  )).length;

  return {
    observationCount: entries.length,
    eligibleCount,
    knowledgeGraphOnlyCount: entries.length - eligibleCount,
    conflictCount: conflictingIds.size,
    contextGroups: [...groups.values()],
    crossContextComparisons,
    formalModelChanged: false
  };
}

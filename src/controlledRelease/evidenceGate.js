function sameContext(left = {}, right = {}) {
  return ["disease", "tissue", "species", "assay", "timeContext", "spatialScope", "experimentalSetting"]
    .every((field) => left[field] === right[field]);
}

function observationContext(observation = {}) {
  return {
    disease: observation.disease,
    tissue: observation.tissue,
    species: observation.species,
    assay: observation.assay,
    timeContext: observation.timeContext,
    spatialScope: observation.spatialScope,
    experimentalSetting: observation.experimentalSetting
  };
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

export async function evaluateEvidenceGate({ policy = {}, parameterPolicy = {}, evidence = [] } = {}) {
  const errors = [];
  const publicationIds = evidence.map((item) => item.publicationId).filter(Boolean);
  const uniquePublications = uniqueSorted(publicationIds);
  const groupIds = uniqueSorted(evidence.map((item) => item.researchGroupId));
  const trainingPublicationIds = uniqueSorted(
    evidence.filter((item) => item.assignment === "training").map((item) => item.publicationId)
  );
  const holdoutPublicationIds = uniqueSorted(
    evidence.filter((item) => item.assignment === "holdout").map((item) => item.publicationId)
  );
  const observationIds = uniqueSorted(evidence.flatMap((item) => item.observationIds ?? []));
  const declaredObservationIds = evidence.flatMap((item) => item.observationIds ?? []).filter(Boolean);
  const observations = evidence.flatMap((item) => item.observations ?? []);
  const measurementFingerprints = observations.map((item) => item.measurementFingerprint).filter(Boolean);

  if (uniquePublications.length < (policy.minimumPublications ?? Infinity)) {
    errors.push(`at least ${policy.minimumPublications} unique publications are required`);
  }
  if (publicationIds.length !== uniquePublications.length) errors.push("duplicate publication IDs are not allowed");
  if (groupIds.length < (policy.minimumIndependentGroups ?? Infinity)) {
    errors.push(`at least ${policy.minimumIndependentGroups} independent research groups are required`);
  }
  if (policy.holdoutRequired === true && !holdoutPublicationIds.length) errors.push("a locked holdout publication is required");
  if (measurementFingerprints.length !== new Set(measurementFingerprints).size) errors.push("duplicate measurement fingerprints are not allowed");
  if (declaredObservationIds.length !== new Set(declaredObservationIds).size) errors.push("duplicate observation IDs are not allowed");

  for (const record of evidence) {
    const label = record.publicationId || "unnamed publication";
    if (record.calibrationEligible !== true) errors.push(`${label}: evidence is not calibration eligible`);
    if (!record.researchGroupId) errors.push(`${label}: independent research group ID is required`);
    if (!Array.isArray(record.observationIds) || !record.observationIds.length) errors.push(`${label}: observation IDs are required`);
    if (!Array.isArray(record.observations) || !record.observations.length) errors.push(`${label}: quantitative observations are required`);
    if (!new Set(["training", "holdout"]).has(record.assignment)) errors.push(`${label}: assignment must be training or holdout`);
    if (record.integrityStatus === "conflicted") errors.push(`${label}: unresolved evidence conflict`);
    if (record.integrityStatus === "retracted") errors.push(`${label}: retracted evidence is forbidden`);
    if (record.integrityStatus === "expression_of_concern") errors.push(`${label}: expression of concern blocks release`);
    if (record.integrityStatus !== "clear") errors.push(`${label}: integrity status must be clear`);
    for (const context of record.contexts ?? []) {
      for (const field of ["disease", "tissue", "species", "assay", "timeContext", "spatialScope", "experimentalSetting"]) {
        if (!context?.[field]) errors.push(`${label}: context ${field.replaceAll(/([A-Z])/g, " $1").toLowerCase()} is required`);
      }
    }

    for (const observation of record.observations ?? []) {
      const observationLabel = observation.observationId || `${label} observation`;
      if (!record.observationIds?.includes(observation.observationId)) errors.push(`${observationLabel}: observation ID is not declared by its publication`);
      for (const [field, description] of [
        ["measurementFingerprint", "measurement fingerprint"],
        ["sourceKind", "source kind"],
        ["sourceLocator", "source locator"],
        ["analyte", "analyte"],
        ["reportedUnit", "reported unit"],
        ["assay", "assay"],
        ["timeContext", "time context"],
        ["groupId", "group identity"],
        ["timeUnit", "time unit"],
        ["disease", "disease"],
        ["tissue", "tissue"],
        ["species", "species"],
        ["spatialScope", "spatial scope"],
        ["experimentalSetting", "experimental setting"],
        ["reviewStatus", "independent review status"]
      ]) {
        if (!observation[field]) errors.push(`${observationLabel}: ${description} is required`);
      }
      if (!Number.isInteger(observation.sampleSize) || observation.sampleSize <= 0) errors.push(`${observationLabel}: positive sample size is required`);
      if (!Number.isFinite(observation.timepoint)) errors.push(`${observationLabel}: finite timepoint is required`);
      if (observation.reviewStatus !== "supported") errors.push(`${observationLabel}: supported independent review is required`);
      const observationCompatible = (record.contexts ?? []).some((context) => sameContext(observationContext(observation), context))
        && (parameterPolicy.contexts ?? []).some((context) => sameContext(observationContext(observation), context));
      if (!observationCompatible) errors.push(`${observationLabel}: observation context is incompatible with its publication or parameter policy`);
    }

    const compatible = (record.contexts ?? []).some((context) => (
      (parameterPolicy.contexts ?? []).some((allowed) => sameContext(context, allowed))
    ));
    if (!compatible) errors.push(`${label}: evidence context is incompatible with the parameter policy`);
  }

  const evidenceSetHash = await sha256Jcs({
    policyId: policy.policyId ?? null,
    policyVersion: policy.policyVersion ?? null,
    parameterId: parameterPolicy.parameterId ?? null,
    evidence
  });
  return {
    status: errors.length ? "blocked" : "passed",
    errors: uniqueSorted(errors),
    trainingPublicationIds,
    holdoutPublicationIds,
    independentGroupCount: groupIds.length,
    observationIds,
    measurementFingerprints: uniqueSorted(measurementFingerprints),
    policyId: policy.policyId ?? null,
    policyVersion: policy.policyVersion ?? null,
    parameterId: parameterPolicy.parameterId ?? null,
    evidenceSetHash,
    formalModelChanged: false
  };
}
import { sha256Jcs } from "../quantitativeObservations/canonicalHash.js";

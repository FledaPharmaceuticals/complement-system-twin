function sameContext(left = {}, right = {}) {
  return ["disease", "spatialScope", "experimentalSetting"]
    .every((field) => left[field] === right[field]);
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

export function evaluateEvidenceGate({ policy = {}, parameterPolicy = {}, evidence = [] } = {}) {
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

  if (uniquePublications.length < (policy.minimumPublications ?? Infinity)) {
    errors.push(`at least ${policy.minimumPublications} unique publications are required`);
  }
  if (publicationIds.length !== uniquePublications.length) errors.push("duplicate publication IDs are not allowed");
  if (groupIds.length < (policy.minimumIndependentGroups ?? Infinity)) {
    errors.push(`at least ${policy.minimumIndependentGroups} independent research groups are required`);
  }
  if (policy.holdoutRequired === true && !holdoutPublicationIds.length) errors.push("a locked holdout publication is required");

  for (const record of evidence) {
    const label = record.publicationId || "unnamed publication";
    if (record.calibrationEligible !== true) errors.push(`${label}: evidence is not calibration eligible`);
    if (!record.researchGroupId) errors.push(`${label}: independent research group ID is required`);
    if (!Array.isArray(record.observationIds) || !record.observationIds.length) errors.push(`${label}: observation IDs are required`);
    if (!new Set(["training", "holdout"]).has(record.assignment)) errors.push(`${label}: assignment must be training or holdout`);
    if (record.integrityStatus === "conflicted") errors.push(`${label}: unresolved evidence conflict`);
    if (record.integrityStatus === "retracted") errors.push(`${label}: retracted evidence is forbidden`);
    if (record.integrityStatus === "expression_of_concern") errors.push(`${label}: expression of concern blocks release`);
    if (record.integrityStatus !== "clear") errors.push(`${label}: integrity status must be clear`);

    const compatible = (record.contexts ?? []).some((context) => (
      (parameterPolicy.contexts ?? []).some((allowed) => sameContext(context, allowed))
    ));
    if (!compatible) errors.push(`${label}: evidence context is incompatible with the parameter policy`);
  }

  return {
    status: errors.length ? "blocked" : "passed",
    errors: uniqueSorted(errors),
    trainingPublicationIds,
    holdoutPublicationIds,
    independentGroupCount: groupIds.length,
    observationIds,
    formalModelChanged: false
  };
}

const keyFor = (...parts) => parts.map((part) => String(part || "").trim().toLowerCase()).join("|");

function uniqueBy(items, makeKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = makeKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildEvidenceGuidance(plan = {}, records = []) {
  const sources = records.filter((record) => record?.pmid && record?.title);
  const mechanisticClaims = uniqueBy(
    sources.flatMap((record) => (record.mechanisticClaims || []).map((text) => ({
      text,
      pmid: record.pmid,
      title: record.title,
      experimentalContext: record.experimentalContext || "Context not specified"
    }))),
    (claim) => keyFor(claim.pmid, claim.text)
  );
  const candidateEffects = uniqueBy(
    sources.flatMap((record) => (record.candidateEffects || []).map((effect) => ({
      target: effect.target,
      direction: effect.direction,
      basis: effect.basis,
      numericValue: effect.numericValue ?? null,
      pmid: record.pmid,
      title: record.title,
      experimentalContext: record.experimentalContext || "Context not specified"
    }))),
    (effect) => keyFor(effect.pmid, effect.target, effect.direction, effect.basis)
  );
  const transferLimits = uniqueBy(
    sources.flatMap((record) => (record.transferLimits || []).map((text) => `${text} (PMID ${record.pmid})`)),
    (item) => item
  );

  return {
    status: "candidate_review",
    diseaseContext: plan.diseaseContext || "unknown",
    focus: [...(plan.focus || [])],
    intervention: [...(plan.intervention || [])],
    sources,
    mechanisticClaims,
    candidateEffects,
    transferLimits,
    uncertainty: sources.length ? "source-specific; cross-context transfer not validated" : "no directly linked source",
    reviewRequirement: "AI-assisted consistency review and domain validation are required before versioned promotion.",
    formalModelChanged: false
  };
}

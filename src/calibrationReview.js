export function reviewCalibrationCandidates(candidates = []) {
  const conflicts = [];
  const byParameter = new Map();
  candidates.forEach((candidate, index) => {
    const group = byParameter.get(candidate.parameter) ?? [];
    group.push({ candidate, index });
    byParameter.set(candidate.parameter, group);
  });

  for (const [parameter, group] of byParameter) {
    for (let left = 0; left < group.length; left += 1) {
      for (let right = left + 1; right < group.length; right += 1) {
        const first = group[left].candidate;
        const second = group[right].candidate;
        const directionConflict = new Set([first.direction, second.direction]).size > 1
          && first.direction !== "no_change"
          && second.direction !== "no_change";
        const rangeConflict = first.suggestedRange.max < second.suggestedRange.min
          || second.suggestedRange.max < first.suggestedRange.min;
        if (!directionConflict && !rangeConflict) continue;
        conflicts.push({
          id: `conflict:${parameter}:${conflicts.length + 1}`,
          parameter,
          candidateIds: [first.id, second.id],
          reasons: [
            ...(directionConflict ? ["opposite_direction"] : []),
            ...(rangeConflict ? ["non_overlapping_ranges"] : [])
          ],
          status: "needs_review"
        });
      }
    }
  }

  const conflictByCandidate = new Map();
  conflicts.forEach((conflict) => conflict.candidateIds.forEach((id) => {
    const ids = conflictByCandidate.get(id) ?? [];
    ids.push(conflict.id);
    conflictByCandidate.set(id, ids);
  }));
  return {
    conflicts,
    candidates: candidates.map((candidate) => ({
      ...candidate,
      reviewStatus: conflictByCandidate.has(candidate.id) ? "needs_review" : "no_conflict_detected",
      conflictIds: conflictByCandidate.get(candidate.id) ?? []
    }))
  };
}

import { diseaseOrganWeightMatrix } from "./organWeightMatrix.js";

const ORGAN_WEIGHT_KEYS = Object.freeze({
  blood: "bloodRbc",
  brain: "brainCns",
  skin: "skinJoint",
  vessels: "vessels",
  vascular: "vascular",
  immune: "immuneComplement",
  retina: "retinaEye",
  rpe: "rpe",
  choroid: "choroid",
  kidney: "kidney",
  liver: "liver",
  lung: "lung"
});

export function rankDiseaseSpecificImpacts(diseaseContext, impacts) {
  const weights = diseaseOrganWeightMatrix[diseaseContext];
  if (!weights) return impacts.map((impact) => ({ ...impact, weight: null }));

  return impacts
    .map((impact) => {
      const key = ORGAN_WEIGHT_KEYS[impact.id] ?? impact.id;
      const weight = Number.isFinite(weights[key]) ? weights[key] : 1;
      const rawScore = Number.isFinite(impact.score) ? impact.score : 0;
      // Disease weights express tissue priority; the raw signal remains visible but cannot erase it.
      const weightedScore = Math.round(Math.max(0, Math.min(100, rawScore * 0.35 + (weight / 10) * 65)));
      return { ...impact, score: weightedScore, weight };
    })
    .sort((a, b) => b.score - a.score);
}

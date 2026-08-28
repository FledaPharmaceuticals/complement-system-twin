export const AMD_ORGAN_WEIGHTS = {
  retinaEye: 10,
  macula: 10,
  rpe: 10,
  choroid: 8,
  drusen: 8,
  vascular: 4,
  immuneComplement: 5,
  brainCns: 2,
  kidney: 1,
  liver: 0.5,
  lung: 0.5,
  skinJoint: 0.5,
  bloodRbc: 0.5
};

export const PNH_ORGAN_WEIGHTS = {
  bloodRbc: 10,
  boneMarrow: 8,
  kidney: 4,
  liver: 3,
  vessels: 3
};

export const AHUS_ORGAN_WEIGHTS = {
  kidney: 10,
  vessels: 9,
  brainCns: 5,
  bloodRbc: 4,
  liver: 2
};

export const SEPSIS_ORGAN_WEIGHTS = {
  vessels: 10,
  lung: 9,
  liver: 8,
  kidney: 8,
  brainCns: 6,
  bloodRbc: 5,
  skinJoint: 3
};

export const diseaseOrganWeightMatrix = {
  AMD: AMD_ORGAN_WEIGHTS,
  PNH: PNH_ORGAN_WEIGHTS,
  aHUS: AHUS_ORGAN_WEIGHTS,
  sepsis: SEPSIS_ORGAN_WEIGHTS
};

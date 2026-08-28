import { entities, relationships, diseases, drugs, publications } from "./data.js";
import { runComplementSimulation } from "./simulation.js";
import { MODEL_VERSION, COMPLEMENT_SIGNAL_KEYS, DISEASE_CONTEXTS } from "./modelContract.js";
import { simulateVersioned } from "./versionedSimulation.js";
import { generateCalibrationCandidates } from "./calibrationCandidates.js";
import { MODEL_RELEASES, getModelRelease, createModelChangeRecord } from "./modelRegistry.js";
import { buildEvidenceCatalog, findEvidenceForEntity } from "./evidenceCatalog.js";
import { normalizePubMedRecords } from "./publicEvidenceAdapter.js";

export const complementSystemTwinApi = {
  getEntities: () => entities,
  getRelationships: () => relationships,
  getPathways: () => ["classical", "lectin", "alternative", "terminal", "regulatory", "inflammatory"],
  getDiseases: () => diseases,
  getDrugs: () => drugs,
  getPublications: () => publications,
  getEvidenceCatalog: () => buildEvidenceCatalog({ publications }),
  getEvidenceForEntity: (entityId) => findEvidenceForEntity(buildEvidenceCatalog({ publications }), entityId),
  normalizePubMedRecords,
  getModelManifest: () => ({
    modelVersion: MODEL_VERSION,
    releases: MODEL_RELEASES,
    diseaseContexts: Object.values(DISEASE_CONTEXTS),
    complementSignalKeys: [...COMPLEMENT_SIGNAL_KEYS],
    clinicalPrediction: false
  }),
  simulate: (input) => runComplementSimulation(input),
  simulateVersioned: (input, options) => simulateVersioned(input, options),
  suggestCalibration: (input) => generateCalibrationCandidates(input),
  getModelRelease,
  createModelChangeRecord,
  createPublication: (publication) => ({ status: "not_persisted_in_v1", publication })
};

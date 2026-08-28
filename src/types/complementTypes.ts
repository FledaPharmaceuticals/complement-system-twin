export type ComplementEntityType =
  | "protein"
  | "fragment"
  | "enzyme_complex"
  | "receptor"
  | "regulator"
  | "pathway"
  | "disease"
  | "drug"
  | "biomarker"
  | "cell_type"
  | "tissue"
  | "gene"
  | "publication";

export interface ComplementEntity {
  id: string;
  name: string;
  symbol: string;
  entity_type: ComplementEntityType;
  description: string;
  pathway_membership: string[];
  upstream_entities: string[];
  downstream_entities: string[];
  regulators: string[];
  diseases: string[];
  drug_targets: string[];
  evidence_level: string;
  references: string[];
}

export type ComplementRelationshipType =
  | "activates"
  | "cleaves"
  | "inhibits"
  | "stabilizes"
  | "degrades"
  | "forms_complex_with"
  | "binds_receptor"
  | "increases"
  | "decreases"
  | "associated_with"
  | "biomarker_for"
  | "target_of";

export interface ComplementRelationship {
  id: string;
  source: string;
  target: string;
  relationship_type: ComplementRelationshipType;
  direction: "directed" | "undirected";
  strength_score: number | null;
  mechanism: string;
  evidence_level: string;
  reference_ids: string[];
}

export interface ComplementSimulationInput {
  classical: number;
  lectin: number;
  alternative: number;
  terminal: number;
  factorH: number;
  factorI: number;
  cd55: number;
  cd59: number;
  diseaseContext: string;
  c1sInhibition: number;
  masp2Inhibition: number;
  c3Inhibition: number;
  factorBInhibition: number;
  factorDInhibition: number;
  c5Inhibition: number;
  c5aRInhibition: number;
}

export interface ComplementSimulationResult {
  c3Activation: number;
  c3aSignal: number;
  c3bOpsonization: number;
  c5Activation: number;
  c5aSignal: number;
  macFormation: number;
  hostCellDamageRisk: number;
  pathogenDefenseCompromise: number;
  infectionRisk: number;
  diseaseActivityProxy: number;
  dominantDriver: string;
  diseaseLabel: string;
}

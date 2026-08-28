export interface ProteinConcentrationSeries {
  entityId: string;
  name: string;
  symbol: string;
  unit: string;
  colorKey: string;
  data: Array<{ time: number; value: number }>;
}

export interface SimulationTimePoint {
  time: number;
  concentrations: Record<string, number>;
}

export interface ComplementDynamicsSimulationInput {
  duration: number;
  timeStep: number;
  initialConcentrations: Record<string, number>;
  reactionRates?: Record<string, number>;
  diseaseContext: string;
  interventions: Record<string, number>;
}

export interface ComplementDynamicsSimulationResult {
  timePoints: SimulationTimePoint[];
  series: ProteinConcentrationSeries[];
  events: Array<{ time: number; label: string; description: string }>;
  summary: string;
}

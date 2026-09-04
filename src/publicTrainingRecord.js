import { validateTrainingRecordSnapshot } from "./modelTrainingRecords/validateTrainingRecord.js";

const VALIDATED_VIEWS = new WeakSet();

export const UNAVAILABLE_TRAINING_RECORD_VIEW = Object.freeze({
  status: "unavailable",
  snapshot: null
});

export async function createValidatedTrainingRecordView(snapshot, registry) {
  const validatedSnapshot = await validateTrainingRecordSnapshot(snapshot, registry);
  const view = Object.freeze({ status: "available", snapshot: validatedSnapshot });
  VALIDATED_VIEWS.add(view);
  return view;
}

export function isValidatedTrainingRecordView(value) {
  return Boolean(
    value
    && value.status === "available"
    && VALIDATED_VIEWS.has(value)
    && value.snapshot
    && Object.isFrozen(value.snapshot)
    && Array.isArray(value.snapshot.records)
    && value.snapshot.records.length > 0
    && value.snapshot.records.every(Object.isFrozen)
  );
}

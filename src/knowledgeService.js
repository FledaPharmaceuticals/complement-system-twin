const SERVICE_BASE_URL = "http://127.0.0.1:8790";

export async function getKnowledgeRecords(fetchImpl = fetch, limit = 100) {
  const response = await fetchImpl(`${SERVICE_BASE_URL}/api/knowledge/records?limit=${limit}`);
  if (!response.ok) throw new Error("Public knowledge layer could not be loaded");
  const payload = await response.json();
  return {
    records: Array.isArray(payload.records) ? payload.records : [],
    count: Number(payload.count) || 0,
    dataBoundary: payload.data_boundary || "standalone_fleda_public_knowledge_layer"
  };
}

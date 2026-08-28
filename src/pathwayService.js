const SERVICE_BASE_URL = "http://127.0.0.1:8790";

export async function getLocalPathwayAnnotations(fetchImpl = fetch, limit = 100) {
  const response = await fetchImpl(`${SERVICE_BASE_URL}/api/annotations/reactome/records?limit=${limit}`);
  if (!response.ok) throw new Error("Pathway annotations could not be loaded");
  const payload = await response.json();
  return {
    records: Array.isArray(payload.records) ? payload.records : [],
    count: Number(payload.count) || 0,
    dataBoundary: payload.data_boundary || "standalone_fleda_pathway_annotations"
  };
}

export async function fetchReactomePathway(stableId, fetchImpl = fetch) {
  const response = await fetchImpl(`${SERVICE_BASE_URL}/api/annotations/reactome`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stable_id: stableId, save: true })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.detail?.message || payload.detail || "Reactome lookup failed");
  return payload;
}

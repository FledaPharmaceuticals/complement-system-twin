const SERVICE_BASE_URL = "http://127.0.0.1:8790";

export async function getLocalProteinAnnotations(fetchImpl = fetch, limit = 100) {
  const response = await fetchImpl(`${SERVICE_BASE_URL}/api/annotations/uniprot/records?limit=${limit}`);
  if (!response.ok) throw new Error("Protein annotations could not be loaded");
  const payload = await response.json();
  return {
    records: Array.isArray(payload.records) ? payload.records : [],
    count: Number(payload.count) || 0,
    dataBoundary: payload.data_boundary || "standalone_fleda_public_annotations"
  };
}

export async function searchUniProtAnnotations(query, size = 10, fetchImpl = fetch) {
  const response = await fetchImpl(`${SERVICE_BASE_URL}/api/annotations/uniprot/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, size, save: true })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.detail?.message || payload.detail || "UniProt search failed");
  return payload;
}

const SERVICE_BASE_URL = "http://127.0.0.1:8790";


export async function getLiteratureServiceStatus(fetchImpl = fetch) {
  try {
    const [healthResponse, budgetResponse] = await Promise.all([
      fetchImpl(`${SERVICE_BASE_URL}/api/health`),
      fetchImpl(`${SERVICE_BASE_URL}/api/budget`)
    ]);
    if (!healthResponse.ok || !budgetResponse.ok) {
      throw new Error("Literature service returned an error");
    }
    return {
      online: true,
      health: await healthResponse.json(),
      budget: await budgetResponse.json(),
      error: null
    };
  } catch (error) {
    return {
      online: false,
      health: null,
      budget: null,
      error: error instanceof Error ? error.message : "Service unavailable"
    };
  }
}

export async function getLocalLiteratureRecords(fetchImpl = fetch, limit = 100) {
  const response = await fetchImpl(`${SERVICE_BASE_URL}/api/literature/records?limit=${limit}`);
  if (!response.ok) throw new Error("Literature records could not be loaded");
  const payload = await response.json();
  return {
    records: Array.isArray(payload.records) ? payload.records : [],
    count: Number(payload.count) || 0,
    dataBoundary: payload.data_boundary || "standalone_fleda_local_records"
  };
}

export async function searchPublicPubMed(query, retmax = 10, fetchImpl = fetch, includeAbstract = false, source = "pubmed") {
  const response = await fetchImpl(`${SERVICE_BASE_URL}/api/pubmed/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, retmax, save: true, include_abstract: includeAbstract, source })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.detail?.message || payload.detail || "PubMed search failed");
  }
  return payload;
}

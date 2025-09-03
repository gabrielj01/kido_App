import  api  from '../api/client';

export async function fetchBabysitters(params = {}) {
  const { data } = await api.get('/api/babysitters', { params });
  return data; // { meta, data: [...] }
}

// Server should accept these query params optionally
export async function searchBabysitters(params = {}) {
  return api.get("/api/babysitters", { params });
}


import  api  from '../api/client';

export async function fetchBabysitters(params = {}) {
  const { data } = await api.get('/api/babysitters', { params });
  return data; // { meta, data: [...] }
}

// Server should accept these query params optionally
export async function searchBabysitters(params = {}) {
  return api.get("/api/babysitters", { params });
}

/** Fetch reviews for a given babysitter */
export async function fetchBabysitterReviews(sitterId, { page = 1, limit = 20 } = {}) {
  try {
    // Preferred nested route
    const res = await api.get(`/api/babysitters/${sitterId}/reviews`, { params: { page, limit } });
    return normalizeReviewsResponse(res.data);
  } catch (e) {
    // Fallback to generic query route
    const res2 = await api.get(`/api/reviews`, { params: { sitterId, page, limit } });
    return normalizeReviewsResponse(res2.data);
  }
}

/** Optional: compute an aggregate if backend doesn't provide it */
export function computeReviewStats(reviews = []) {
  if (!reviews.length) return { avg: 0, count: 0, dist: [0,0,0,0,0] };
  const dist = [0,0,0,0,0];
  let sum = 0;
  for (const r of reviews) {
    const s = Math.min(5, Math.max(1, Math.round(r.rating || 0)));
    dist[s - 1] += 1;
    sum += r.rating || 0;
  }
  return { avg: +(sum / reviews.length).toFixed(1), count: reviews.length, dist };
}

/** Normalize shape coming from either endpoint */
function normalizeReviewsResponse(payload) {
  // Accept shapes: {data:{items,meta}} or {items,meta} or direct array
  const data = payload?.data ?? payload;
  const items = data?.items ?? data?.reviews ?? (Array.isArray(data) ? data : []);
  const meta = data?.meta ?? {};
  return { items, meta };
}


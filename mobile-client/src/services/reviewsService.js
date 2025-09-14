// Reviews API helpers (robust to two possible endpoints)
import api from "../api/client";

/** Fetch reviews for a given babysitter */
export async function fetchBabysitterReviews(sitterId, { page = 1, limit = 20 } = {}) {
  // Try nested route first, fallback to generic collection
  try {
    const res = await api.get(`/api/babysitters/${sitterId}/reviews`, { params: { page, limit } });
    return normalizeReviewsResponse(res.data);
  } catch (e) {
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
  const data = payload?.data ?? payload;
  const items = data?.items ?? data?.reviews ?? (Array.isArray(data) ? data : []);
  const meta = data?.meta ?? {};
  return { items, meta };
}

export async function addSitterReview(sitterId, payload) {
  // payload: { rating:number(1..5), comment?:string, bookingId?:string, authorName?:string }
  const res = await api.post(`/api/babysitters/${sitterId}/reviews`, payload);
  return res.data?.data ?? res.data;
}

export async function fetchEndedUnreviewedBookings() {
  let bookings = [];
  // Try a dedicated endpoint first if present
  try {
    const r = await api.get("/api/bookings/pending-reviews");
    const data = r.data?.data ?? r.data;
    if (Array.isArray(data)) {
      return data
        .map(b => ({
          bookingId: b.bookingId || b._id || b.id,
          sitterId:  b.sitterId  || b.babysitterId || b?.babysitter?._id,
          sitterName: b.sitterName || b?.babysitter?.name || "the sitter",
        }))
        .filter(x => x.bookingId && x.sitterId);
    }
  } catch (_) {}

  // Fallbacks: /api/bookings/me -> /api/booking/me
  try {
    const r = await api.get("/api/bookings/me");
    bookings = r.data?.data ?? r.data ?? [];
  } catch (_) {
    const r2 = await api.get("/api/booking/me");
    bookings = r2.data?.data ?? r2.data ?? [];
  }

  const now = Date.now();
  return bookings
    .filter((b) => {
      const end = new Date(b.endTime || b.end || b.endAt || 0).getTime();
      const ended = end && end < now;
      const canceled =
        Boolean(b.canceled) ||
        b.status === "canceled" ||
        b.status === "cancelled";
      const reviewed =
        Boolean(b.reviewId) || Boolean(b.reviewed) || Boolean(b.hasReview);
      return ended && !canceled && !reviewed;
    })
    .map((b) => ({
      bookingId: b._id || b.id,
      sitterId: b.babysitterId || b.sitterId || b?.babysitter?._id,
      sitterName: b?.babysitter?.name || b?.sitter?.name || b?.babysitterName || "the sitter",
    }))
    .filter((x) => x.bookingId && x.sitterId);
}


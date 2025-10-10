import api from "../api/client";

/** Normalize various backend shapes into { items, meta } */
function normalizeReviewsResponse(payload) {
  // Accept shapes:
  // - { data: { items, meta } }
  // - { data: [...] }
  // - { items: [...] }
  // - [...]
  const root = payload?.data ?? payload ?? {};
  if (Array.isArray(root)) {
    return { items: root, meta: { page: 1, limit: root.length, total: root.length } };
  }
  if (Array.isArray(root.items)) {
    return {
      items: root.items,
      meta: root.meta || { page: 1, limit: root.items.length, total: root.items.length },
    };
  }
  if (Array.isArray(root.data)) {
    return { items: root.data, meta: { page: 1, limit: root.data.length, total: root.data.length } };
  }
  return { items: [], meta: { page: 1, limit: 0, total: 0 } };
}

/** Fetch reviews list for a given babysitter (with fallback to /api/reviews?sitterId=...) */
export async function fetchBabysitterReviews(sitterId, { page = 1, limit = 20 } = {}) {
  const id = String(sitterId);
  try {
    const res = await api.get(`/api/babysitters/${id}/reviews`, { params: { page, limit } });
    return normalizeReviewsResponse(res.data);
  } catch {
    const res2 = await api.get(`/api/reviews`, { params: { sitterId, page, limit } });
    return normalizeReviewsResponse(res2.data);
  }
}

/** Create a review for a sitter */
export async function addSitterReview(sitterId, body) {
  // Body should contain: { rating, comment?, bookingId (required), authorName? }
  const res = await api.post(`/api/babysitters/${String(sitterId)}/reviews`, body);
  return res.data?.data || res.data;
}

/** Optional local aggregate computation from a reviews array */
export function computeReviewStats(reviewsLike) {
  // Accept shapes: raw array OR { items } OR { data: { items } }
  let items = [];
  if (Array.isArray(reviewsLike)) {
    items = reviewsLike;
  } else if (Array.isArray(reviewsLike?.items)) {
    items = reviewsLike.items;
  } else if (Array.isArray(reviewsLike?.data?.items)) {
    items = reviewsLike.data.items;
  } else if (Array.isArray(reviewsLike?.data)) {
    items = reviewsLike.data;
  }

  const count = items.length;
  const sum = items.reduce((acc, r) => acc + (Number(r?.rating) || 0), 0);
  const avg = count ? +(sum / count).toFixed(2) : 0;
  return { avg, count, sum, items };
}

/** Map a raw booking to a "candidate" shape used by the UI */
function mapBookingToCandidate(b) {
  return {
    bookingId: b._id || b.id,
    sitterId: b.babysitterId || b.sitterId || b?.babysitter?._id,
    sitterName: b?.babysitter?.name || b?.sitter?.name || b?.babysitterName || "the sitter",
  };
}

/** True if a booking ended in the past, is completed, not cancelled, and not reviewed */
function isEndedAndUnreviewed(b) {
  const end = new Date(b.endISO || b.endTime || 0);
  const ended = !Number.isNaN(end) && end < new Date();
  const cancelled = b.status === "canceled" || b.status === "cancelled";
  const reviewed = Boolean(b.reviewId) || Boolean(b.reviewed) || Boolean(b.hasReview);
  return ended && !cancelled && !reviewed && b.status === "completed";
}

/** Fallback: derive review candidates from a generic bookings list */
export function findEndedUnreviewedFromList(bookings = []) {
  return (bookings || [])
    .filter(isEndedAndUnreviewed)
    .map(mapBookingToCandidate)
    .filter((x) => x.bookingId && x.sitterId);
}

/** Preferred: ask backend for pending review candidates */
export async function fetchPendingReviewCandidates() {
  try {
    const res = await api.get(`/api/bookings/pending-reviews`);
    const arr = Array.isArray(res.data?.data) ? res.data.data : [];
    return arr
      .map((x) => ({
        bookingId: x.bookingId || x.id,
        sitterId: x.sitterId || x.revieweeId,
        sitterName: x.sitterName || "the sitter",
      }))
      .filter((x) => x.bookingId && x.sitterId);
  } catch {
    // Fallback: fetch my bookings and compute client-side
    const res2 = await api.get(`/api/bookings`, { params: { role: "parent" } });
    const list = Array.isArray(res2.data?.data) ? res2.data.data : (Array.isArray(res2.data) ? res2.data : []);
    return findEndedUnreviewedFromList(list);
  }
}

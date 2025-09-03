import api from "./client"; 

// Create a booking
export async function createBooking({ babysitterId, startTime, endTime }) {
  // server expects: babysitterId, startTime, endTime (ISO strings)
  const res = await api.post("/api/bookings", { babysitterId, startTime, endTime });
  // server returns the created booking object
  return res.data;
}

export async function hideBookingById(id) {
  const res = await api.delete(`/api/bookings/${id}`);
  return res.data;
}

// List bookings (filter by parentId, babysitterId, status)
export async function listBookings(params = {}) {
  const res = await api.get("/api/bookings", { params });
  const payload = res.data;
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

// Get one booking
export async function getBookingById(id) {
  const res = await api.get(`/api/bookings/${id}`);
  return res.data;
}

// Cancel a booking
export async function cancelBooking(id) {
  const res = await api.put(`/api/bookings/${id}/cancel`);
  return res.data;
}

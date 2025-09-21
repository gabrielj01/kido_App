import api from "./client";
import { emit } from "../contexts/EventBus";

// Create a booking
export async function createBooking({ babysitterId, startTime, endTime }) {
  const res = await api.post("/api/bookings", { babysitterId, startTime, endTime });
  const data = res.data;
  emit?.("bookings:changed");
  return data;
}

export async function hideBookingById(id) {
  const res = await api.delete(`/api/bookings/${id}`);
  const data = res.data;
  emit?.("bookings:changed");
  return data;
}

// List bookings (filter by parent/sitter role, status)
export async function listBookings(params = {}) {
  const res = await api.get("/api/bookings", { params });
  const payload = res.data;
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

// Get details
export async function getBookingById(id) {
  const res = await api.get(`/api/bookings/${id}`);
  return res.data;
}

// Cancel (parent or sitter)
export async function cancelBooking(id) {
  const res = await api.put(`/api/bookings/${id}/cancel`);
  const data = res.data;
  emit?.("bookings:changed");
  return data;
}

// Sitter accepts / declines
export async function sitterDecision(id, decision /* 'accepted' | 'declined' */) {
  const res = await api.patch(`/api/bookings/${id}/decision`, { decision });
  const data = res.data;
  emit?.("bookings:changed");
  return data;
}


export async function completeBooking(id) {
  const res = await api.patch(`/api/bookings/${id}/complete`);
  const data = res.data;
  emit?.("bookings:changed");
  return data;
}

export async function getUpcomingBookings({ limit = 5, status = "accepted" } = {}) {
  const res = await api.get("/api/bookings/upcoming", { params: { limit, status } });
  return res.data || [];
}

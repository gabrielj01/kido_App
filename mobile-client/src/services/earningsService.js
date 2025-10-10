import api from "../api/client";

/** Safe number */
const N = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

/** Hours between two ISO strings (float hours) */
export function hoursBetween(startISO, endISO) {
  const s = new Date(startISO);
  const e = new Date(endISO);
  if (Number.isNaN(+s) || Number.isNaN(+e)) return 0;
  const ms = e.getTime() - s.getTime();
  return ms > 0 ? ms / 3_600_000 : 0;
}

/** Compute booking amount with robust fallbacks */
export function computeBookingAmount(b) {
  // Priority 1: explicit totalPrice
  const totalPrice = N(b?.totalPrice, NaN);
  if (Number.isFinite(totalPrice)) return totalPrice;

  // Priority 2: rateSnapshot * totalHours
  const rateSnapshot = N(b?.rateSnapshot, NaN);
  const totalHours = N(b?.totalHours, NaN);
  if (Number.isFinite(rateSnapshot) && Number.isFinite(totalHours)) {
    return rateSnapshot * totalHours;
  }

  // Priority 3: rateSnapshot * (end - start)
  if (Number.isFinite(rateSnapshot)) {
    const hrs = hoursBetween(b?.startISO || b?.startTime, b?.endISO || b?.endTime);
    return rateSnapshot * hrs;
  }

  // Priority 4: sitter hourly rate (populated or denormalized)
  const rate =
    N(b?.hourlyRate, NaN) ||
    N(b?.sitterId?.hourlyRate, NaN) ||
    N(b?.babysitter?.hourlyRate, NaN) ||
    NaN;

  if (Number.isFinite(rate)) {
    const hrs =
      Number.isFinite(totalHours) ? totalHours : hoursBetween(b?.startISO || b?.startTime, b?.endISO || b?.endTime);
    return rate * hrs;
  }

  return 0;
}

/** Pull sitter bookings (array) */
export async function fetchSitterBookings() {
  const res = await api.get("/api/bookings", { params: { role: "sitter" } });
  const raw = res?.data?.data ?? res?.data ?? [];
  return Array.isArray(raw) ? raw : [];
}

/** Return only completed bookings in [start,end] (inclusive). If start/end are null => all time. */
export function filterCompletedInRange(bookings, start, end) {
  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;

  return (bookings || []).filter((b) => {
    const status = String(b?.status || "").toLowerCase();
    if (status !== "completed") return false;

    const endAt = new Date(b?.endISO || b?.endTime || 0);
    if (Number.isNaN(+endAt)) return false;

    const afterStart = !s || endAt >= s;
    const beforeEnd = !e || endAt <= e;
    return afterStart && beforeEnd;
  });
}

/** Compute aggregates for a list of bookings */
export function computeEarnings(bookings = []) {
  let jobs = 0;
  let totalHours = 0;
  let totalEarnings = 0;

  const rows = (bookings || []).map((b) => {
    const hrs =
      Number.isFinite(N(b?.totalHours)) && N(b?.totalHours) > 0
        ? N(b?.totalHours)
        : hoursBetween(b?.startISO || b?.startTime, b?.endISO || b?.endTime);

    // Try best available rate for display purposes
    const rate =
      N(b?.rateSnapshot, NaN) ||
      N(b?.hourlyRate, NaN) ||
      N(b?.sitterId?.hourlyRate, NaN) ||
      N(b?.babysitter?.hourlyRate, NaN) ||
      0;

    // Amount with robust fallback
    let amount = computeBookingAmount(b);
    if (!Number.isFinite(amount) || amount <= 0) {
      amount = rate * hrs;
    }

    jobs += 1;
    totalHours += hrs;
    totalEarnings += amount;

    return {
      id: b?._id || b?.id,
      date: b?.endISO || b?.endTime || b?.startISO || b?.startTime,
      parentName: b?.parentId?.name || b?.parentName || "—",
      hours: hrs,
      rate,
      amount,
      raw: b,
    };
  });

  const avgHourly = totalHours > 0 ? totalEarnings / totalHours : 0;

  return {
    jobs,
    totalHours,
    totalEarnings,
    avgHourly,
    rows: rows.sort((a, z) => new Date(z.date) - new Date(a.date)),
  };
}

/** Common ranges */
export function rangeThisWeek(now = new Date()) {
  const d = new Date(now);
  const day = d.getDay(); // 0=Sun (IL)
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(d.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  end.setMilliseconds(-1);
  return { start, end };
}

export function rangeLastWeek(now = new Date()) {
  const { start: thisStart } = rangeThisWeek(now);
  const start = new Date(thisStart);
  start.setDate(thisStart.getDate() - 7);
  const end = new Date(thisStart);
  end.setMilliseconds(-1);
  return { start, end };
}

export function rangeThisMonth(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  end.setMilliseconds(-1);
  return { start, end };
}

export function rangeAllTime() {
  return { start: null, end: null }; // will include all completed bookings
}

/** Format ILS with symbol */
export function fmtILS(n) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "ILS" }).format(n);
  } catch {
    return `₪${(n ?? 0).toFixed(0)}`;
  }
}

/** Export CSV text */
export function toCSV(rows = []) {
  const esc = (s) => `"${String(s ?? "").replaceAll('"', '""')}"`;
  const header = ["Date", "Parent", "Hours", "Rate", "Amount"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const date = new Date(r.date).toLocaleString();
    lines.push([esc(date), esc(r.parentName), r.hours.toFixed(2), r.rate.toFixed(2), r.amount.toFixed(2)].join(","));
  }
  return lines.join("\n");
}

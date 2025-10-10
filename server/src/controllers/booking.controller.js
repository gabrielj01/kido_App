// server/src/controllers/booking.controller.js
import { Booking } from "../models/Booking.js";
import { User } from "../models/User.js";
import mongoose from "mongoose";

/* --------------------------------
 * Utilities
 * ------------------------------- */

// Build a details object from parent profile when booking.details is missing
function detailsFromParent(parent) {
  if (!parent) return null;
  // Try common shapes: preferences.* + top-level fields we might store on parent
  const prefs = parent.preferences || {};
  const emergency = parent.emergencyContact || {};
  const details = {
    kids: parent.kids || null,
    dietaryPreferences: prefs.dietaryPreferences || prefs.dietary || null,
    allergies: prefs.allergies || null,
    bedtime: prefs.bedtime || null,
    instructions: prefs.instructions || null,
    pets: prefs.pets || null,
    address: parent.address || null,
    emergencyContact: {
      name: emergency.name || null,
      phone: emergency.phone || null,
    },
  };

  // Remove null/empty keys to keep payload clean
  Object.keys(details).forEach((k) => {
    const v = details[k];
    const isEmptyObj = v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0;
    if (v == null || (Array.isArray(v) && v.length === 0) || isEmptyObj) {
      delete details[k];
    }
  });

  return Object.keys(details).length ? details : null;
}

async function autoCompleteEndedBookings() {
  // Convert any 'accepted' booking to 'completed' when its endISO is in the past.
  const now = new Date();

  // Safer cross-Mongo approach: fetch candidates and filter in JS (endISO is a string)
  const candidates = await Booking.find({ status: "accepted" }).select("_id endISO");
  const toComplete = candidates
    .filter((b) => {
      const end = new Date(b.endISO || 0);
      return !Number.isNaN(end) && end < now;
    })
    .map((b) => b._id);

  if (toComplete.length) {
    await Booking.updateMany({ _id: { $in: toComplete } }, { $set: { status: "completed" } });
  }
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  const aS = new Date(aStart);
  const aE = new Date(aEnd);
  const bS = new Date(bStart);
  const bE = new Date(bEnd);
  return aS < bE && bS < aE;
}

function validateTimes(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    return "Invalid date format for startTime or endTime.";
  }
  if (e <= s) {
    return "endTime must be after startTime.";
  }
  return null;
}

/* --------------------------------
 * Controllers
 * ------------------------------- */

export async function createBooking(req, res) {
  try {
    const parentId = req.user?.id || req.user?._id || req.userId || req.auth?.id || null;
    if (!parentId) {
      return res.status(401).json({ error: "Unauthorized: missing user context." });
    }

    const body = req.body || {};

    // Compatibility with older/newer payloads
    const sitterId = body.sitterId || body.babysitterId;
    let date = body.date;
    const startISO = body.startISO || body.startTime;
    const endISO = body.endISO || body.endTime;

    // Derive date (YYYY-MM-DD) if not provided
    if (!date && startISO) {
      const d = new Date(startISO);
      if (!Number.isNaN(d.getTime())) {
        date = d.toISOString().slice(0, 10);
      }
    }

    // Validations
    if (!sitterId || !date || !startISO || !endISO) {
      return res.status(400).json({
        error:
          "Missing fields. Required: sitterId(or babysitterId), date(or startTime), startISO(or startTime), endISO(or endTime).",
      });
    }

    const start = new Date(startISO);
    const end = new Date(endISO);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: "Invalid date format for start/end." });
    }
    if (end <= start) {
      return res.status(400).json({ error: "end time must be after start time." });
    }

    // Ensure target user is a babysitter
    const sitter = await User.findById(sitterId);
    if (!sitter) return res.status(404).json({ error: "Sitter not found." });
    const role = String(sitter.role || "").toLowerCase();
    if (!["babysitter", "sitter"].includes(role)) {
      return res.status(400).json({ error: "Target user is not a babysitter." });
    }

    // Anti-overlap on same sitter/date for (pending|accepted)
    const existing = await Booking.find({
      sitterId,
      status: { $in: ["pending", "accepted"] },
      date,
    });

    const conflict = existing.some((b) => overlaps(new Date(b.startISO), new Date(b.endISO), start, end));
    if (conflict) {
      return res.status(409).json({ error: "This time overlaps with an existing booking." });
    }

    // Pricing snapshot
    const hours = (end - start) / 3_600_000;
    const totalHours = Math.max(0, Math.round(hours * 4) / 4); // quarter-hour rounding
    const rateSnapshot = Number(sitter.hourlyRate || 0);
    const totalPrice = Math.round(totalHours * rateSnapshot * 100) / 100;

    const created = await Booking.create({
      parentId,
      sitterId,
      date,
      startISO,
      endISO,
      status: "pending",
      rateSnapshot,
      totalHours,
      totalPrice,
    });

    // Return a populated doc useful for UI
    const doc = await Booking.findById(created._id)
      .populate("sitterId", "name role email hourlyRate photoUrl avatarUrl certifications languages")
      .populate("parentId", "name email role address preferences kids emergencyContact");

    return res.status(201).json(doc);
  } catch (err) {
    console.error("createBooking error:", err);
    return res.status(500).json({ error: "Failed to create booking", details: err.message });
  }
}

// GET /api/bookings/:id
export async function getBookingById(req, res) {
  try {
    const { id } = req.params;

    // Populate both sides with exactly what the app needs (avatar + parent prefs)
    const booking = await Booking.findById(id)
      .populate("parentId", "name email role address preferences kids emergencyContact photoUrl avatarUrl")
      .populate("sitterId", "name email role hourlyRate certifications languages photoUrl avatarUrl experienceYears")
      .lean();

    if (!booking) return res.status(404).json({ error: "Booking not found" });

    // Hydrate details from parent profile if missing/empty on the booking
    const hasDetails = booking.details && Object.keys(booking.details || {}).length > 0;
    const hydrated = !hasDetails ? detailsFromParent(booking.parentId) : null;

    // Return a clean object with 'details' guaranteed when possible
    return res.json({
      ...booking,
      details: hasDetails ? booking.details : hydrated || booking.details || null,
    });
  } catch (err) {
    console.error("getBookingById error:", err);
    return res.status(500).json({ error: "Failed to fetch booking", details: err.message });
  }
}

// GET /api/bookings?role=parent|sitter&status=...
export async function listBookings(req, res) {
  await autoCompleteEndedBookings();
  try {
    const uid = req.user?.id || req.user?._id || req.userId || null;
    const { role, status } = req.query || {};
    const filter = {};

    // Role-based filter; default to parent with req.user
    if (role === "parent") {
      filter.parentId = uid;
      filter.hiddenForParent = { $ne: true };
    } else if (role === "sitter") {
      filter.sitterId = uid;
      filter.hiddenForSitter = { $ne: true };
    } else if (uid) {
      filter.parentId = uid;
      filter.hiddenForParent = { $ne: true };
    }

    if (status) filter.status = status;

    const data = await Booking.find(filter)
      .sort({ startISO: 1 })
      .populate("sitterId", "name hourlyRate photoUrl avatarUrl")
      .populate("parentId", "name photoUrl")
      .lean();

    return res.json(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error("listBookings error:", err);
    return res.status(500).json({ error: "Failed to list bookings", details: err.message });
  }
}

export async function cancelBooking(req, res) {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    // Authorization: parent who created or (optionally) sitter can cancel
    const requesterId = req.user?.id || req.user?._id;
    if (!requesterId) return res.status(401).json({ error: "Unauthorized" });

    const isParent = String(booking.parentId) === String(requesterId);
    const isSitter = String(booking.sitterId) === String(requesterId);

    if (!isParent && !isSitter) {
      return res.status(403).json({ error: "You are not allowed to cancel this booking." });
    }

    booking.status = "cancelled";
    await booking.save();

    const populated = await Booking.findById(id)
      .populate("sitterId", "name hourlyRate photoUrl avatarUrl")
      .populate("parentId", "name email photoUrl");

    return res.json(populated);
  } catch (err) {
    console.error("cancelBooking error:", err);
    return res.status(500).json({ error: "Failed to cancel booking", details: err.message });
  }
}

export async function sitterDecision(req, res) {
  try {
    const requesterId = req.user?.id || req.user?._id || req.userId || null;
    if (!requesterId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const { decision } = req.body; // "accepted" | "declined"
    if (!["accepted", "declined"].includes(decision)) {
      return res.status(400).json({ error: "Decision must be 'accepted' or 'declined'." });
    }

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ error: "Booking not found." });

    // Only the targeted babysitter can decide
    if (String(booking.sitterId) !== String(requesterId)) {
      return res.status(403).json({ error: "Only the babysitter can decide this booking." });
    }
    if (booking.status !== "pending") {
      return res.status(400).json({ error: `Cannot change status from ${booking.status}.` });
    }

    booking.status = decision;
    await booking.save();

    const populated = await Booking.findById(id)
      .populate("sitterId", "name hourlyRate photoUrl avatarUrl")
      .populate("parentId", "name email photoUrl");

    return res.json(populated);
  } catch (err) {
    console.error("sitterDecision error:", err);
    return res.status(500).json({ error: "Failed to update booking", details: err.message });
  }
}

export async function hideBooking(req, res) {
  try {
    const uid = req.user?.id || req.user?._id || req.userId || req.auth?.id || null;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const b = await Booking.findById(id);
    if (!b) return res.status(404).json({ error: "Booking not found" });

    const sitterRef = b.sitterId || b.babysitterId;
    const isParent = String(b.parentId) === String(uid);
    const isSitter = sitterRef && String(sitterRef) === String(uid);
    if (!isParent && !isSitter) {
      return res.status(403).json({ error: "Not allowed to modify this booking" });
    }

    const end = new Date(b.endISO || b.endTime || 0);
    const isPast = !Number.isNaN(end) && end < new Date();
    const terminal = ["cancelled", "declined", "completed"].includes(b.status);
    if (!terminal && !isPast) {
      return res.status(400).json({
        error: "Only past, cancelled, declined or completed bookings can be removed from your list.",
      });
    }

    if (isParent) b.hiddenForParent = true;
    if (isSitter) b.hiddenForSitter = true;
    await b.save();

    return res.json({ ok: true });
  } catch (err) {
    console.error("hideBooking error:", err);
    return res.status(500).json({ error: "Failed to hide booking", details: err.message });
  }
}

// Get upcoming bookings for the current user (parent or babysitter)
export async function getUpcoming(req, res) {
  try {
    const userId = req.user?.id || req.user?._id || req.userId || req.auth?.id || null;
    const role = String(req.user?.role || "").toLowerCase(); // "parent" | "babysitter"

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // Default: only accepted bookings in the future
    const statusQ = (req.query.status || "accepted")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const limit = Math.min(Math.max(parseInt(req.query.limit || "5", 10), 1), 50);

    // We store start as ISO string -> lexicographic compare works if ISO RFC3339
    const nowISO = new Date().toISOString();

    // Role-based filter + hidden flags
    let filter;
    if (role === "babysitter" || role === "sitter") {
      filter = {
        sitterId: userId,
        hiddenForSitter: { $ne: true },
      };
    } else {
      filter = {
        parentId: userId,
        hiddenForParent: { $ne: true },
      };
    }

    Object.assign(filter, {
      status: { $in: statusQ },
      startISO: { $gte: nowISO },
    });

    const bookings = await Booking.find(filter)
      .sort({ startISO: 1 })
      .limit(limit)
      // populate both sides for names/avatars in UI
      .populate("sitterId", "name photoUrl avatarUrl hourlyRate role")
      .populate("parentId", "name photoUrl avatarUrl role")
      .lean();

    return res.json(bookings);
  } catch (err) {
    console.error("getUpcoming error:", err);
    return res.status(500).json({ message: "Failed to load upcoming bookings", details: err.message });
  }
}

export async function completeBooking(req, res) {
  try {
    const requesterId = req.user?.id || req.user?._id || req.userId || null;
    if (!requesterId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ error: "Booking not found." });

    // Only sitter can complete
    if (String(booking.sitterId) !== String(requesterId)) {
      return res.status(403).json({ error: "Only the babysitter can complete this booking." });
    }
    if (booking.status !== "accepted") {
      return res.status(400).json({ error: `Only 'accepted' bookings can be completed.` });
    }

    const end = new Date(booking.endISO || booking.endTime || 0);
    if (!(end instanceof Date) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: "Invalid end time on booking." });
    }
    if (end > new Date()) {
      return res.status(400).json({ error: "You can mark as completed only after the end time." });
    }

    booking.status = "completed";
    await booking.save();

    const populated = await Booking.findById(id)
      .populate("sitterId", "name hourlyRate photoUrl avatarUrl")
      .populate("parentId", "name email photoUrl");

    return res.json(populated);
  } catch (err) {
    console.error("completeBooking error:", err);
    return res.status(500).json({ error: "Failed to complete booking", details: err.message });
  }
}

// GET /api/bookings/pending-reviews
// Returns minimal items the parent can review now (completed & ended, and no existing review)
export async function getPendingReviews(req, res) {
  try {
    const parentId = req.user?.id;
    if (!parentId) return res.status(401).json({ error: "Unauthorized" });

    const now = new Date();
    const parentObjId = new mongoose.Types.ObjectId(parentId);

    const rows = await Booking.aggregate([
      { $match: { parentId: parentObjId, status: "completed" } },
      // Convert string ISO to date for proper comparison
      { $addFields: { _end: { $toDate: "$endISO" } } },
      { $match: { _end: { $lt: now } } },
      // Join with reviews to ensure none exists for this booking
      { $lookup: { from: "reviews", localField: "_id", foreignField: "bookingId", as: "rev" } },
      { $match: { $expr: { $eq: [{ $size: "$rev" }, 0] } } },
      // Bring sitter's display name
      { $lookup: { from: "users", localField: "sitterId", foreignField: "_id", as: "sitter" } },
      { $unwind: { path: "$sitter", preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, bookingId: "$_id", sitterId: 1, sitterName: "$sitter.name" } },
      { $limit: 10 },
    ]);

    return res.json({ data: rows });
  } catch (err) {
    console.error("getPendingReviews error:", err);
    return res.status(500).json({ error: "Failed to load pending reviews", details: err.message });
  }
}

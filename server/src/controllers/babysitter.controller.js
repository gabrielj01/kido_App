import User from "../models/User.js";
import Review from "../models/Review.js";
import mongoose from "mongoose";
import{ Booking } from "../models/Booking.js";

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const escapeRegex = (s) =>
  String(s ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Haversine via aggregation for distanceKm
const distKmExpr = (lat, lng) => ({
  $multiply: [
    6371,
    {
      $acos: {
        $add: [
          {
            $multiply: [
              { $sin: { $degreesToRadians: "$latitude" } },
              { $sin: { $degreesToRadians: lat } },
            ],
          },
          {
            $multiply: [
              { $cos: { $degreesToRadians: "$latitude" } },
              { $cos: { $degreesToRadians: lat } },
              {
                $cos: {
                  $subtract: [
                    { $degreesToRadians: "$longitude" },
                    { $degreesToRadians: lng },
                  ],
                },
              },
            ],
          },
        ],
      },
    },
  ],
});

/**
 * GET /api/babysitters
 * Default: returns ONLY users with role "babysitter".
 * Set ?strictRole=false to include everyone for debugging.
 *
 * Query params (all optional):
 * - q | query
 * - language | lang
 * - minPrice | minRate ; maxPrice | maxRate
 * - minRating
 * - lat | latitude ; lng | longitude ; maxDist | maxKm
 * - sort = distance|price|price_asc|price_desc|rating|rating_desc|rating_count|relevance
 * - page (1) ; limit (50, max 100)
 * - strictRole (default true)
 */
export async function listBabysitters(req, res) {
  try {
    // ---- Parse & normalize params ----
    const q = req.query.q ?? req.query.query ?? "";
    const language = req.query.language ?? req.query.lang ?? "";

    const minPrice = toNum(req.query.minPrice ?? req.query.minRate ?? req.query.min_rate);
    const maxPrice = toNum(req.query.maxPrice ?? req.query.maxRate ?? req.query.max_rate);
    const minRating = toNum(req.query.minRating ?? req.query.ratingMin ?? req.query.rating);

    const lat = toNum(req.query.lat ?? req.query.latitude);
    const lng = toNum(req.query.lng ?? req.query.longitude);
    const maxDist = toNum(req.query.maxDist ?? req.query.maxKm);

    // ✅ By default: restrict role to babysitters
    const strictRole = !/^(0|false|no)$/i.test(String(req.query.strictRole ?? "true"));

    const sortRaw = String(req.query.sort || "relevance").toLowerCase();
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || "50", 10)));

    // ---- Build base $match ----
    const match = {};

    if (strictRole) {
      match.role = { $in: ["babysitter", "BABYSITTER"] };
    }

    if (q && String(q).trim()) {
      const rx = new RegExp(escapeRegex(q.trim()), "i");
      match.$or = [
        { name: rx },
        { fullName: rx },
        { city: rx },
        { address: rx },
        { "address.city": rx },
      ];
    }

    if (language && String(language).trim()) {
      const rx = new RegExp(escapeRegex(language.trim()), "i");
      match.languages = { $elemMatch: { $regex: rx } };
    }

    if (minPrice !== null || maxPrice !== null) {
      const or = [];
      if (minPrice !== null && maxPrice !== null) {
        or.push({ hourlyRate: { $gte: minPrice, $lte: maxPrice } });
      } else if (minPrice !== null) {
        or.push({ hourlyRate: { $gte: minPrice } });
      } else if (maxPrice !== null) {
        or.push({ hourlyRate: { $lte: maxPrice } });
      }
      or.push({ hourlyRate: { $exists: false } }, { hourlyRate: null });
      match.$and = (match.$and || []).concat([{ $or: or }]);
    }

    if (minRating !== null) {
      match.$and = (match.$and || []).concat([
        {
          $or: [
            { ratingAvg: { $gte: minRating } },
            { rating: { $gte: minRating } },
            { ratingAvg: { $exists: false } },
          ],
        },
      ]);
    }

    const pipeline = [{ $match: match }, { $project: { password: 0, __v: 0 } }];

    const hasCoords = lat !== null && lng !== null;
    if (hasCoords) {
      pipeline.push({ $addFields: { distanceKm: distKmExpr(lat, lng) } });
      if (maxDist !== null) {
        pipeline.push({
          $match: {
            $or: [
              { distanceKm: { $lte: maxDist } },
              { workRadiusKm: { $gte: maxDist } },
              { workRadiusKm: { $exists: false } },
            ],
          },
        });
      }
    }

    if (q && String(q).trim()) {
      const pattern = escapeRegex(String(q).trim());
      pipeline.push({
        $addFields: {
          _haystack: {
            $concat: [
              { $ifNull: ["$name", ""] }, " ",
              { $ifNull: ["$fullName", ""] }, " ",
              { $ifNull: ["$city", ""] }, " ",
              { $ifNull: ["$address.city", ""] }, " ",
              {
                $cond: [
                  { $isArray: "$languages" },
                  {
                    $reduce: {
                      input: "$languages",
                      initialValue: "",
                      in: { $concat: ["$$value", " ", { $toString: "$$this" }] }
                    }
                  },
                  ""
                ]
              }
            ],
          },
        },
      });
      pipeline.push({
        $addFields: {
          relevance: {
            $cond: [
              { $regexMatch: { input: "$_haystack", regex: pattern, options: "i" } },
              1,
              0,
            ],
          },
        },
      });
    }

    let sortStage = { createdAt: -1 };
    switch (sortRaw) {
      case "distance":
        sortStage = hasCoords ? { distanceKm: 1 } : { createdAt: -1 };
        break;
      case "price":
      case "price_asc":
      case "rate_asc":
        sortStage = { hourlyRate: 1 };
        break;
      case "price_desc":
      case "rate_desc":
        sortStage = { hourlyRate: -1 };
        break;
      case "rating":
      case "rating_desc":
        sortStage = { ratingAvg: -1, ratingCount: -1 };
        break;
      case "rating_count":
        sortStage = { ratingCount: -1 };
        break;
      case "relevance":
      default:
        sortStage = q ? { relevance: -1, ratingAvg: -1, ratingCount: -1, createdAt: -1 } : { createdAt: -1 };
        break;
    }
    pipeline.push({ $sort: sortStage });

    pipeline.push({
      $facet: {
        data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        total: [{ $count: "count" }],
      },
    });
    pipeline.push({
      $project: {
        data: 1,
        total: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
      },
    });

    const [result] = await User.aggregate(pipeline);
    const data = result?.data ?? [];
    const total = result?.total ?? 0;

    res.json({
      meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
      data,
    });
  } catch (err) {
    console.error("listBabysitters error:", err);
    res.status(500).json({ error: "Failed to fetch babysitters", details: err.message });
  }
}

/* ------------------------- REVIEWS: GET & POST ------------------------- */

/** Recompute sitter's ratingAvg & ratingCount from Review collection */
async function recomputeSitterStats(sitterId) {
  const agg = await Review.aggregate([
    { $match: { revieweeId: new mongoose.Types.ObjectId(sitterId) } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const avg = agg.length ? Math.round(agg[0].avg * 10) / 10 : 0;
  const count = agg.length ? agg[0].count : 0;
  await User.findByIdAndUpdate(sitterId, { ratingAvg: avg, ratingCount: count });
}

/** GET /api/babysitters/:id/reviews */
export async function getSitterReviews(req, res) {
  const { id } = req.params;
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const limit = Math.max(1, Math.min(50, parseInt(req.query.limit || "20", 10)));
  const skip = (page - 1) * limit;

  const sitterId = new mongoose.Types.ObjectId(id);
  const [items, total] = await Promise.all([
    Review.find({ revieweeId: sitterId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Review.countDocuments({ revieweeId: sitterId }),
  ]);

  return res.json({ data: { items, meta: { page, limit, total } } });
}

/** POST /api/babysitters/:id/reviews */
export async function addSitterReview(req, res) {
  const { id } = req.params; // sitterId
  const { rating, comment, bookingId, authorName } = req.body || {};
  const userId = req.user?.id;
  const userRole = String(req.user?.role || "").toLowerCase();

   if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (userRole !== "parent") {
    return res.status(403).json({ error: "Only parents can post reviews" });
  }
  if (!bookingId) {
    return res.status(400).json({ error: "bookingId is required" });
  }
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Rating must be between 1 and 5." });
  }

  // Ensure sitter exists and is a babysitter
  const sitter = await User.findById(id).lean();
  if (!sitter || String(sitter.role).toLowerCase() !== "babysitter") {
    return res.status(404).json({ error: "Babysitter not found." });
  }

  // Ensure booking belongs to this parent and sitter, is completed, and ended
  const booking = await Booking.findOne({ _id: bookingId, parentId: userId, sitterId: id }).lean();
  if (!booking) {
    return res.status(404).json({ error: "Booking not found for this parent/sitter pair" });
  }
  if (booking.status !== "completed") {
    return res.status(409).json({ error: "You can only review completed bookings" });
  }
  const end = new Date(booking.endISO || booking.endTime || 0);
  if (Number.isNaN(end) || end >= new Date()) {
    return res.status(409).json({ error: "You can only review an already ended booking" });
  }
  // Idempotence: ensure no existing review for this booking
  const exists = await Review.exists({ bookingId });
  if (exists) {
    return res.status(409).json({ error: "A review already exists for this booking" });
  }

  // Create review, seal reviewer = authenticated parent
  const doc = await Review.create({
    bookingId,
    reviewerId: userId,
    revieweeId: id,
    rating,
    comment: (comment || "").trim(),
    authorName: (authorName || "Parent").trim(),
  });


  await recomputeSitterStats(id);
  return res.status(201).json({ data: doc });
}

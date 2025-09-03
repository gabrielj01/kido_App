// server/src/controllers/babysitter.controller.js
import User from "../models/User.js";

/** Helpers */
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const escapeRegex = (s) =>
  String(s ?? "")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

    // ✅ Par défaut: on force role = "babysitter"
    const strictRole = !/^(0|false|no)$/i.test(String(req.query.strictRole ?? "true"));

    const sortRaw = String(req.query.sort || "relevance").toLowerCase();
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || "50", 10)));

    // ---- Build base $match (tolerant on filters, strict on role by default) ----
    const match = {};

    if (strictRole) {
      // ton schéma utilise "babysitter" (pas "sitter")
      match.role = { $in: ["babysitter", "BABYSITTER"] };
    }

    // Text search (name/city/address string or nested)
    if (q && String(q).trim()) {
      const rx = new RegExp(escapeRegex(q.trim()), "i");
      match.$or = [
        { name: rx },
        { fullName: rx },
        { city: rx },
        { address: rx },         // address as string (legacy)
        { "address.city": rx },  // address nested
      ];
    }

    // Language contains
    if (language && String(language).trim()) {
      const rx = new RegExp(escapeRegex(language.trim()), "i");
      match.languages = { $elemMatch: { $regex: rx } };
    }

    // Price range (keep docs without price)
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

    // Min rating (only if fields exist)
    if (minRating !== null) {
      match.$and = (match.$and || []).concat([
        {
          $or: [
            { ratingAvg: { $gte: minRating } },
            { rating: { $gte: minRating } },
            { ratingAvg: { $exists: false } }, // keep profiles with no rating
          ],
        },
      ]);
    }

    // ---- Aggregation pipeline ----
    const pipeline = [{ $match: match }, { $project: { password: 0, __v: 0 } }];

    // Distance compute
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

    // Lightweight relevance if q present
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

    // Sorting
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

    // Pagination with total count
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
    res
      .status(500)
      .json({ error: "Failed to fetch babysitters", details: err.message });
  }

}

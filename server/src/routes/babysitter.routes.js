import { Router } from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import { listBabysitters, getSitterReviews, addSitterReview } from "../controllers/babysitter.controller.js";
import User from "../models/User.js";

const router = Router();

/** List/search babysitters */
router.get("/", authMiddleware, listBabysitters);

/** Get one babysitter by id */
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await User.findById(id).lean();
    if (!doc) return res.status(404).json({ error: "Babysitter not found" });
    res.json({ data: doc });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

/** Reviews endpoints */
router.get("/:id/reviews", authMiddleware, getSitterReviews);
router.post("/:id/reviews", authMiddleware, addSitterReview);

export default router;

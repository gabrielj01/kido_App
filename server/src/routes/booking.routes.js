// server/src/routes/booking.routes.js
import { Router } from "express";
import {
  createBooking,
  getBookingById,
  listBookings,
  cancelBooking,
  sitterDecision,
  hideBooking,
} from "../controllers/booking.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", authMiddleware, createBooking);
router.get("/", authMiddleware, listBookings);
router.get("/:id", authMiddleware, getBookingById);
router.put("/:id/cancel", authMiddleware, cancelBooking);
router.patch("/:id/decision", authMiddleware, sitterDecision);
router.delete("/:id", authMiddleware, hideBooking);

export default router;

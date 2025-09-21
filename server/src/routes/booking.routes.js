import { Router } from "express";
import {
  createBooking,
  getBookingById,
  listBookings,
  cancelBooking,
  sitterDecision,
  hideBooking,
  getUpcoming,
  completeBooking,
} from "../controllers/booking.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", authMiddleware, createBooking);
router.get("/", authMiddleware, listBookings);
router.get("/upcoming", authMiddleware, getUpcoming);
router.get("/:id", authMiddleware, getBookingById);
router.put("/:id/cancel", authMiddleware, cancelBooking);
router.patch("/:id/decision", authMiddleware, sitterDecision);
router.patch("/:id/complete", authMiddleware, completeBooking);
router.delete("/:id", authMiddleware, hideBooking);

export default router;

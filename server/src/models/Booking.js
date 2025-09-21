import mongoose from "mongoose";

const BookingSchema = new mongoose.Schema(
  {
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sitterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    startISO: { type: String, required: true },
    endISO: { type: String, required: true },
    status: { type: String, enum: ["pending", "accepted", "declined", "cancelled", "completed"], default: "pending" },
    notes: { type: String, default: "" },
    rateSnapshot: { type: Number, default: 0 },
    totalHours: { type: Number, default: 0 },
    totalPrice: { type: Number, default: 0 },
    hiddenForParent: { type: Boolean, default: false },
    hiddenForSitter: { type: Boolean, default: false },

  },
  { timestamps: true }
);

export const Booking = mongoose.model("Booking", BookingSchema);

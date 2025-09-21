// All comments in English as requested.
import mongoose from "mongoose";
const { Schema, model, models, Types } = mongoose;

const ReviewSchema = new Schema(
  {
    bookingId:   { type: Types.ObjectId, ref: "Booking", sparse: true },
    reviewerId:  { type: Types.ObjectId, ref: "User" },
    revieweeId:  { type: Types.ObjectId, ref: "User", required: true },
    rating:      { type: Number, min: 1, max: 5, required: true },
    comment:     { type: String, maxlength: 1000, trim: true },
    authorName:  { type: String, maxlength: 120, trim: true, default: "Parent" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// ---------- Centralized indexes (single source of truth) ----------
ReviewSchema.index({ revieweeId: 1, createdAt: -1 }, { name: "by_sitter_date" });  // fast listing
ReviewSchema.index({ bookingId: 1 }, { unique: true, sparse: true, name: "uniq_booking" }); // 1 review per booking
// Optional: at most one review per (sitter, reviewer)
// ReviewSchema.index({ revieweeId: 1, reviewerId: 1 }, { unique: true, sparse: true, name: "uniq_reviewer_per_sitter" });

ReviewSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

// Avoid model recompilation in dev/hot-reload
export default models.Review || model("Review", ReviewSchema);

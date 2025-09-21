import mongoose from "mongoose";

const { Schema } = mongoose;

/** Helpers */
function toAddressObject(addr) {
  // Normalize address to { street, city }
  if (!addr) return {};
  if (typeof addr === "object" && !Array.isArray(addr)) return addr;
  if (typeof addr === "string") {
    const [street, city] = addr.split(",").map(s => String(s || "").trim());
    return { street: street || "", city: city || "" };
  }
  return {};
}

/** Subdocs (kept minimal to match current UI) */
const KidSchema = new Schema(
  {
    name: { type: String, default: "" }, // optional, UI only needs count
    age: { type: Number, default: null },
  },
  { _id: false }
);

const PreferencesSchema = new Schema(
  {
    dietary: { type: [String], default: [] },
    languages: { type: [String], default: [] },
    preferredGender: { type: String, enum: ["male", "female", "no_pref"], default: "no_pref" },
  },
  { _id: false }
);

const AvailabilitySchema = new Schema(
  {
    day: { type: String, enum: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"], required: true },
    hours: { type: [String], default: [] }, // e.g. ["08:00-12:00","14:00-18:00"]
  },
  { _id: false }
);

const StatsSchema = new Schema(
  {
    bookingsCompleted: { type: Number, default: 0 },
  },
  { _id: false }
);

/** Main schema */
const userSchema = new Schema(
  {
    // Core
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role:     { type: String, enum: ["parent", "babysitter"], required: true },

    // Contacts
    phone:    { type: String, default: "" },

    // Location (Israel market)
    address:    { type: mongoose.Schema.Types.Mixed, default: {} }, // keep Mixed for backward compatibility
    latitude:   { type: Number, default: null },
    longitude:  { type: Number, default: null },
    workRadiusKm: { type: Number, default: null }, // sitter-only (UI reads this)

    // Babysitter profile
    hourlyRate:     { type: Number, default: 0 },
    certifications: { type: [String], default: [] },
    experience:     { type: String, default: "" },  // free text legacy
    experienceYears:{ type: Number, default: null }, // UI shows numeric if present
    availability:   { type: [AvailabilitySchema], default: [] },

    // Parent profile
    kids:        { type: [KidSchema], default: [] },
    preferences: { type: PreferencesSchema, default: () => ({}) },

    // Generic profile/meta
    age:      { type: Number, default: null },
    photoUrl: { type: String, default: "" },
    bio:      { type: String, default: "" },

    // Ratings aggregate
    ratingAvg:   { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },

    // Stats (can be denormalized latest)
    stats: { type: StatsSchema, default: () => ({}) },

    lastActiveAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        // Hide sensitive/internal fields
        delete ret.password;
        delete ret.__v;

        // Normalize address to { city, street }
        ret.address = toAddressObject(ret.address);

        // Map common UI aliases
        // - Front sometimes reads `type` instead of `role`
        ret.type = ret.role === "babysitter" ? "sitter" : ret.role;

        // - Avatar alias
        ret.avatarUrl = ret.avatarUrl || ret.photoUrl || "";

        // - Rate alias
        ret.rate = ret.rate ?? ret.hourlyRate;

        // - Work radius also accepted from legacy address.radiusKm
        if (ret.workRadiusKm == null && ret.address && typeof ret.address === "object") {
          ret.workRadiusKm = ret.address.radiusKm ?? null;
        }

        // - Languages/dietary at top-level (UI falls back to user.languages / user.dietary)
        const pref = ret.preferences || {};
        ret.languages = Array.isArray(ret.languages) ? ret.languages : (pref.languages || []);
        ret.dietary  = Array.isArray(ret.dietary)  ? ret.dietary  : (pref.dietary  || []);

        // - Stats fallback (UI reads user.stats.bookingsCompleted or user.bookingsCompleted)
        if (!ret.stats) ret.stats = {};
        if (ret.stats.bookingsCompleted == null && ret.bookingsCompleted != null) {
          ret.stats.bookingsCompleted = ret.bookingsCompleted;
        }
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

/** Virtuals that make UI life easier (non-breaking) */
// In case some parts of UI use .type already
userSchema.virtual("type").get(function () {
  return this.role === "babysitter" ? "sitter" : this.role;
});

userSchema.virtual("avatarUrl").get(function () {
  return this.photoUrl || "";
});

userSchema.virtual("rate").get(function () {
  return this.hourlyRate;
});

// Top-level aliases for preferences
userSchema.virtual("languages").get(function () {
  return (this.preferences && this.preferences.languages) || [];
});
userSchema.virtual("dietary").get(function () {
  return (this.preferences && this.preferences.dietary) || [];
});

// Safe index example for geo queries later (optional)
// userSchema.index({ latitude: 1, longitude: 1 });

export const User = mongoose.model("User", userSchema);
export default User;

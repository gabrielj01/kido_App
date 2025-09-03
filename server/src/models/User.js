// models/User.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

const ratingSchema = new Schema(
  {
    fromUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    toUser:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
    score:    { type: Number, min: 1, max: 5, required: true },
    comment:  { type: String, default: '' }
  },
  { timestamps: true }
);

const userSchema = new Schema(
  {
    name:       { type: String, required: true, trim: true },
    email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
    username:   { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    password:   { type: String, required: true },
    role:       { type: String, enum: ['parent', 'babysitter'], required: true },

    // Basic location for Israel market
    // Accept both string OR object without casting errors
    address:    { type: mongoose.Schema.Types.Mixed, default: {} },
    latitude:   { type: Number, default: null },
    longitude:  { type: Number, default: null },

    // Babysitter-specific (harmless if parent)
    hourlyRate:     { type: Number, default: 0 },
    certifications: { type: [String], default: [] },
    experience:     { type: String, default: '' },
    availability: {
      type: [
        new mongoose.Schema(
          {
            day:   { type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'], required: true },
            hours: { type: [String], default: [] },
          },
          { _id: false }
        )
      ],
  default: [],
},

    // Profile
    age:       { type: Number, default: null },
    photoUrl:  { type: String, default: '' },
    bio:       { type: String, default: '' },

    // Ratings aggregate (computed from ratings collection or updated transactionally later)
    ratingAvg:   { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },

    // Optional: keep a denormalized lastActive for future features
    lastActiveAt: { type: Date, default: null }
  },
  { timestamps: true }
);

export const Rating = mongoose.model('Rating', ratingSchema);
export const User = mongoose.model('User', userSchema);

export default User;
const ReviewSchema = new Schema({
  bookingId: { type: ObjectId, ref: 'Booking', required: true, unique: true }, // one review per booking
  reviewerId: { type: ObjectId, ref: 'User', required: true },
  revieweeId: { type: ObjectId, ref: 'User', required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now }
});

import mongoose from 'mongoose';

// The "purchasing history": holiday holds (skipped) and one-off extra copies.
const adjustmentSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    publication: { type: mongoose.Schema.Types.ObjectId, ref: 'Publication', default: null }, // null = all
    date: { type: Date, required: true },
    type: { type: String, enum: ['skipped', 'extra'], required: true },
    quantity: { type: Number, default: 1, min: 1 },
    note: { type: String, trim: true, default: '', maxlength: 200 },
  },
  { timestamps: true }
);

adjustmentSchema.index({ customer: 1, date: 1 });

export const DeliveryAdjustment = mongoose.model('DeliveryAdjustment', adjustmentSchema);

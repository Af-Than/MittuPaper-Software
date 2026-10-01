import mongoose from 'mongoose';

// One entry per rate change. Bills always pick the entry effective on each delivery date,
// so appending a new entry never alters past bills.
const rateSchema = new mongoose.Schema(
  {
    ratePerCopy: { type: Number, required: true, min: 0, validate: Number.isInteger }, // paise
    effectiveFrom: { type: Date, required: true },
    setBy: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const publicationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: ['newspaper', 'magazine'], required: true },
    language: { type: String, required: true, trim: true, default: 'Malayalam' },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'fortnightly', 'monthly'],
      required: true,
    },
    active: { type: Boolean, default: true },
    rates: { type: [rateSchema], default: [] },
  },
  { timestamps: true }
);

publicationSchema.index({ type: 1, name: 1 });

export const Publication = mongoose.model('Publication', publicationSchema);

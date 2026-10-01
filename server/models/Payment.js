import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    bill: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill', required: true },
    amount: { type: Number, required: true, min: 1, validate: Number.isInteger }, // paise
    date: { type: Date, required: true },
    mode: { type: String, enum: ['cash', 'upi', 'other'], default: 'cash' },
    note: { type: String, trim: true, default: '', maxlength: 200 },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    recordedByName: { type: String, default: '' },
  },
  { timestamps: true }
);

paymentSchema.index({ customer: 1, date: -1 });
paymentSchema.index({ bill: 1 });
paymentSchema.index({ date: -1 });

export const Payment = mongoose.model('Payment', paymentSchema);

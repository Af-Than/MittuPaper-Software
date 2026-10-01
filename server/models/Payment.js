import mongoose from 'mongoose';

// A payment can cover more than one month's bill at once (oldest-first allocation, or a
// specific month chosen by the admin), so the amount is split across one or more bills.
const allocationSchema = new mongoose.Schema(
  { bill: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill', required: true }, amount: { type: Number, required: true, min: 1 } },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    // Convenience reference to the first/primary bill this payment touched (for simple display).
    bill: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill', required: true },
    allocations: { type: [allocationSchema], default: [] },
    amount: { type: Number, required: true, min: 1, validate: Number.isInteger }, // paise, total across allocations
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

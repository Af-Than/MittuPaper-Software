import mongoose from 'mongoose';

const otherExpenseSchema = new mongoose.Schema(
  {
    category: { type: String, enum: ['rent', 'electricity', 'phone-internet', 'stationery-packing', 'publisher-payment', 'miscellaneous'], required: true },
    amount: { type: Number, required: true, min: 1, validate: Number.isInteger }, // paise
    date: { type: Date, required: true },
    description: { type: String, trim: true, required: true, maxlength: 300 },
    paymentMode: { type: String, enum: ['cash', 'upi', 'other'], default: 'cash' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

otherExpenseSchema.index({ date: 1 });
otherExpenseSchema.index({ category: 1 });

export const OtherExpense = mongoose.model('OtherExpense', otherExpenseSchema);

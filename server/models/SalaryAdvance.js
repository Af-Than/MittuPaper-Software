import mongoose from 'mongoose';

const salaryAdvanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    amount: { type: Number, required: true, min: 1, validate: Number.isInteger }, // paise
    givenOn: { type: Date, required: true },
    reason: { type: String, trim: true, default: '', maxlength: 200 },
    recoveredAmount: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

salaryAdvanceSchema.index({ employee: 1, givenOn: 1 });

export const SalaryAdvance = mongoose.model('SalaryAdvance', salaryAdvanceSchema);

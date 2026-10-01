import mongoose from 'mongoose';

const salaryPaymentSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    forMonth: { type: Number, required: true, min: 1, max: 12 },
    forYear: { type: Number, required: true },
    baseSalary: { type: Number, required: true, min: 0, validate: Number.isInteger }, // snapshot, paise
    bonus: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    deductions: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    advanceRecovered: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    netPaid: { type: Number, required: true, min: 0, validate: Number.isInteger }, // base+bonus-deductions-advanceRecovered
    paidOn: { type: Date, required: true }, // business date AND time
    mode: { type: String, enum: ['cash', 'upi', 'bank'], default: 'cash' },
    reference: { type: String, trim: true, default: '', maxlength: 80 },
    note: { type: String, trim: true, default: '', maxlength: 200 },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    recordedByName: { type: String, default: '' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

salaryPaymentSchema.index({ employee: 1, forYear: 1, forMonth: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });

export const SalaryPayment = mongoose.model('SalaryPayment', salaryPaymentSchema);

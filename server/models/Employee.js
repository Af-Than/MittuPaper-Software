import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 }, // Malayalam Unicode supported
    phone: { type: String, required: true, trim: true, match: /^[6-9]\d{9}$/ },
    role: { type: String, enum: ['delivery', 'supervisor'], default: 'delivery' },
    joinDate: { type: Date, required: true },
    monthlySalary: { type: Number, required: true, min: 0, validate: Number.isInteger }, // paise
    salaryDueDay: { type: Number, default: 1, min: 1, max: 28 }, // salary is due on this day of the month
    active: { type: Boolean, default: true },
    notes: { type: String, trim: true, default: '', maxlength: 500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    deletedAt: { type: Date, default: null }, // soft delete
  },
  { timestamps: true }
);

employeeSchema.index({ name: 1 });
employeeSchema.index({ active: 1, deletedAt: 1 });

export const Employee = mongoose.model('Employee', employeeSchema);

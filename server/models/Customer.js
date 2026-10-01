import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    // Indian 10-digit mobile number (starts with 6-9)
    phone: { type: String, required: true, trim: true, match: /^[6-9]\d{9}$/ },
    notes: { type: String, trim: true, default: '', maxlength: 500 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

customerSchema.index({ name: 1 });
customerSchema.index({ active: 1 });

export const Customer = mongoose.model('Customer', customerSchema);

import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    // Indian 10-digit mobile number (starts with 6-9)
    phone: { type: String, required: true, trim: true, match: /^[6-9]\d{9}$/ },
    notes: { type: String, trim: true, default: '', maxlength: 500 },
    active: { type: Boolean, default: true },
    // Delivery routing (optional) — who delivers to this customer, and the named route/area.
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    routeName: { type: String, trim: true, default: '', maxlength: 80 },
  },
  { timestamps: true }
);

customerSchema.index({ name: 1 });
customerSchema.index({ active: 1 });
customerSchema.index({ employee: 1 });

export const Customer = mongoose.model('Customer', customerSchema);

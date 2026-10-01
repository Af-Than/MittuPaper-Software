import mongoose from 'mongoose';

const fuelEntrySchema = new mongoose.Schema(
  {
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null }, // auto-filled from vehicle, editable
    fuelledAt: { type: Date, required: true }, // business date/time
    litres: { type: Number, required: true, min: 0 }, // kWh for EVs, same field
    pricePerLitre: { type: Number, required: true, min: 0, validate: Number.isInteger }, // paise
    amount: { type: Number, required: true, min: 0, validate: Number.isInteger }, // paise, auto-calc but editable
    odometer: { type: Number, required: true, min: 0 },
    station: { type: String, trim: true, default: '', maxlength: 120 },
    fullTank: { type: Boolean, default: true },
    paymentMode: { type: String, enum: ['cash', 'upi', 'other'], default: 'cash' },
    receiptNo: { type: String, trim: true, default: '', maxlength: 60 },
    note: { type: String, trim: true, default: '', maxlength: 200 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

fuelEntrySchema.index({ vehicle: 1, fuelledAt: 1 });
fuelEntrySchema.index({ employee: 1, fuelledAt: 1 });

export const FuelEntry = mongoose.model('FuelEntry', fuelEntrySchema);

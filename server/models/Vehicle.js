import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema(
  {
    // Kerala format: KL-07-AB-1234 (hyphens optional on entry, normalised in the controller)
    registrationNumber: { type: String, required: true, trim: true, uppercase: true, unique: true, match: /^KL-\d{1,2}-[A-Z]{1,2}-\d{4}$/ },
    type: { type: String, enum: ['bike', 'scooter', 'mini-van', 'auto', 'ev-scooter'], required: true },
    makeModel: { type: String, trim: true, default: '', maxlength: 80 },
    fuelType: { type: String, enum: ['petrol', 'diesel', 'electric'], required: true },
    assignedEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    status: { type: String, enum: ['active', 'in-repair', 'retired'], default: 'active' },
    odometer: { type: Number, default: 0, min: 0 },
    insuranceExpiry: { type: Date, default: null },
    pollutionExpiry: { type: Date, default: null }, // PUC
    fitnessExpiry: { type: Date, default: null },
    lastServiceDate: { type: Date, default: null },
    nextServiceDueKm: { type: Number, default: null },
    notes: { type: String, trim: true, default: '', maxlength: 500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

vehicleSchema.index({ assignedEmployee: 1 });
vehicleSchema.index({ status: 1, deletedAt: 1 });

export const Vehicle = mongoose.model('Vehicle', vehicleSchema);

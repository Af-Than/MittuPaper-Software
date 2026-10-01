import mongoose from 'mongoose';

const repairEntrySchema = new mongoose.Schema(
  {
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    repairedAt: { type: Date, required: true },
    category: { type: String, enum: ['service', 'tyre', 'brake', 'engine', 'battery', 'electrical', 'accident', 'other'], required: true },
    description: { type: String, trim: true, required: true, maxlength: 300 },
    workshop: { type: String, trim: true, default: '', maxlength: 120 },
    partsCost: { type: Number, default: 0, min: 0, validate: Number.isInteger }, // paise
    labourCost: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    total: { type: Number, default: 0, min: 0, validate: Number.isInteger }, // auto = parts+labour, editable
    odometer: { type: Number, default: null },
    invoiceNo: { type: String, trim: true, default: '', maxlength: 60 },
    status: { type: String, enum: ['pending', 'completed'], default: 'completed' },
    nextServiceDate: { type: Date, default: null },
    nextServiceKm: { type: Number, default: null },
    paymentMode: { type: String, enum: ['cash', 'upi', 'other'], default: 'cash' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

repairEntrySchema.index({ vehicle: 1, repairedAt: 1 });
repairEntrySchema.index({ status: 1 });

export const RepairEntry = mongoose.model('RepairEntry', repairEntrySchema);

import mongoose from 'mongoose';

const segmentSchema = new mongoose.Schema(
  { ratePerCopy: Number, copies: Number, amount: Number },
  { _id: false }
);

const lineItemSchema = new mongoose.Schema(
  {
    publication: { type: mongoose.Schema.Types.ObjectId, ref: 'Publication' },
    publicationName: String,
    copies: Number,
    skippedCopies: { type: Number, default: 0 },
    extraCopies: { type: Number, default: 0 },
    ratePerCopy: Number, // rate snapshot (latest rate used in the month)
    amount: Number,
    segments: [segmentSchema], // more than one when the rate changed mid-month
  },
  { _id: false }
);

const dayItemSchema = new mongoose.Schema(
  {
    publication: { type: mongoose.Schema.Types.ObjectId, ref: 'Publication' },
    publicationName: String,
    copies: Number,
    ratePerCopy: Number,
    amount: Number,
  },
  { _id: false }
);

const daySchema = new mongoose.Schema(
  {
    date: String, // YYYY-MM-DD
    weekday: Number,
    items: [dayItemSchema],
    copies: Number,
    amount: Number,
    runningTotal: Number,
  },
  { _id: false }
);

const billSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    lineItems: [lineItemSchema],
    days: [daySchema],
    currentCharges: { type: Number, default: 0 },
    previousDue: { type: Number, default: 0 },
    totalPayable: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    status: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
    generatedAt: { type: Date, default: Date.now },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    generatedByName: { type: String, default: '' },
  },
  { timestamps: true }
);

billSchema.index({ customer: 1, year: 1, month: 1 }, { unique: true });
billSchema.index({ year: 1, month: 1 });
billSchema.index({ status: 1 });

export const Bill = mongoose.model('Bill', billSchema);

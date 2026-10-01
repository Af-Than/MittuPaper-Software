import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    publication: { type: mongoose.Schema.Types.ObjectId, ref: 'Publication', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    // weekdays: copies on the chosen weekdays; fixedPerMonth: fixed copies each month
    mode: { type: String, enum: ['weekdays', 'fixedPerMonth'], required: true },
    weekdays: { type: [Number], default: [] }, // 0 = Sunday ... 6 = Saturday
    copiesPerMonth: { type: Number, default: 0, min: 0 },
    quantity: { type: Number, default: 1, min: 1 }, // copies per delivery in weekdays mode
  },
  { timestamps: true }
);

subscriptionSchema.index({ customer: 1 });
subscriptionSchema.index({ publication: 1 });

export const Subscription = mongoose.model('Subscription', subscriptionSchema);

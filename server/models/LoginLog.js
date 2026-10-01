import mongoose from 'mongoose';

const loginLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    username: { type: String, default: '' },
    adminName: { type: String, default: '' },
    success: { type: Boolean, required: true },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

loginLogSchema.index({ createdAt: -1 });

export const LoginLog = mongoose.model('LoginLog', loginLogSchema);

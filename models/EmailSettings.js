const mongoose = require('mongoose');

/**
 * Optional outbound email overrides (admin). Env vars remain the fallback.
 */
const emailSettingsSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    sendInDevelopment: { type: Boolean, default: false },
    provider: {
      type: String,
      enum: ['smtp', 'sendgrid'],
      default: 'smtp',
    },
    smtpHost: { type: String, default: '', trim: true },
    smtpPort: { type: Number, default: 465 },
    smtpSecure: { type: Boolean, default: true },
    smtpUser: { type: String, default: '', trim: true },
    smtpPassword: { type: String, default: '', select: false },
    sendgridApiKey: { type: String, default: '', select: false },
    fromEmail: { type: String, default: '', trim: true },
    fromName: { type: String, default: 'Bloomwik', trim: true },
    replyTo: { type: String, default: '', trim: true },
    clientUrl: { type: String, default: '', trim: true },
    verificationExpiryHours: { type: Number, default: 24, min: 1, max: 168 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmailSettings', emailSettingsSchema);

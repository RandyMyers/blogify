const mongoose = require('mongoose');

const adEventSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true,
    },
    adId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ad',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['impression', 'click', 'dismissal'],
      required: true,
      index: true,
    },
    eventId: {
      type: String,
      maxlength: 100,
      trim: true,
    },
    countryCode: {
      type: String,
      set: (value) => (
        typeof value === 'string' && value.toLowerCase() === 'unknown'
          ? 'unknown'
          : typeof value === 'string'
            ? value.toUpperCase()
            : value
      ),
      match: /^(?:[A-Z]{2}|unknown)$/,
      default: 'unknown',
    },
    pagePath: {
      type: String,
      maxlength: 500,
      default: null,
    },
  },
  { timestamps: true }
);

adEventSchema.index({ createdAt: -1 });
adEventSchema.index({ adId: 1, type: 1, createdAt: -1 });
adEventSchema.index({ tenantId: 1, countryCode: 1, createdAt: -1 });
adEventSchema.index(
  { tenantId: 1, adId: 1, type: 1, eventId: 1 },
  { unique: true, partialFilterExpression: { eventId: { $type: 'string' } } }
);

module.exports = mongoose.model('AdEvent', adEventSchema);

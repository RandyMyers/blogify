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
      enum: ['impression', 'click'],
      required: true,
      index: true,
    },
    countryCode: {
      type: String,
      uppercase: true,
      match: /^[A-Z]{2}$/,
      default: null,
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

module.exports = mongoose.model('AdEvent', adEventSchema);

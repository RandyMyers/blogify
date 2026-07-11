const mongoose = require('mongoose');

const articleOfferClickSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true,
    },
    articleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Article',
      required: true,
      index: true,
    },
    offerId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    language: {
      type: String,
      trim: true,
      lowercase: true,
      default: 'en',
      index: true,
    },
    offerTitle: { type: String, trim: true, default: '' },
    offerUrl: { type: String, trim: true, default: '' },
    sessionId: { type: String, trim: true, default: '', index: true },
    ipAddress: { type: String, trim: true, default: '' },
    userAgent: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: '' },
    referrer: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

articleOfferClickSchema.index({ createdAt: -1 });
articleOfferClickSchema.index({ tenantId: 1, createdAt: -1 });
articleOfferClickSchema.index({ articleId: 1, offerId: 1, createdAt: -1 });

module.exports = mongoose.model('ArticleOfferClick', articleOfferClickSchema);

const mongoose = require('mongoose');

const seoSettingsSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true,
      index: true,
    },
    siteName: { type: String, default: 'Bloomwik', trim: true },
    siteUrl: { type: String, default: 'https://bloomwik.com', trim: true },
    twitterHandle: { type: String, default: '', trim: true },
    googleSiteVerification: { type: String, default: '', trim: true },
    bingSiteVerification: { type: String, default: '', trim: true },
    sitemap: {
      enabled: { type: Boolean, default: true },
      includeArticles: { type: Boolean, default: true },
      includeCategories: { type: Boolean, default: true },
      includeAuthors: { type: Boolean, default: true },
    },
    indexNow: {
      enabled: { type: Boolean, default: true },
      apiKey: { type: String, default: '', trim: true },
    },
    searchConsole: {
      autoSubmitSitemap: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SeoSettings', seoSettingsSchema);

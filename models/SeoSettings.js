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
    comments: {
      autoApproveVerifiedReaders: { type: Boolean, default: false },
    },
    contentSeo: {
      minPublishScore: { type: Number, default: 0, min: 0, max: 100 },
      warnPublishScore: { type: Number, default: 60, min: 0, max: 100 },
      requireFocusKeyword: { type: Boolean, default: false },
      requireMetaOnPublish: { type: Boolean, default: true },
      metaTitleTemplate: { type: String, default: '{{title}} | {{siteName}}', trim: true },
      metaDescriptionTemplate: { type: String, default: '{{excerpt}}', trim: true },
      categoryMetaTitleTemplate: { type: String, default: '{{name}} Articles | {{siteName}}', trim: true },
      categoryMetaDescriptionTemplate: { type: String, default: '{{description}}', trim: true },
      authorMetaTitleTemplate: { type: String, default: '{{name}} | {{siteName}}', trim: true },
      authorMetaDescriptionTemplate: { type: String, default: '{{bio}}', trim: true },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SeoSettings', seoSettingsSchema);

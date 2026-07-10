const SeoSettings = require('../models/SeoSettings');

const DEFAULTS = {
  siteName: 'Bloomwik',
  siteUrl: process.env.CLIENT_URL || 'https://bloomwik.com',
  twitterHandle: '',
  googleSiteVerification: '',
  bingSiteVerification: '',
  sitemap: {
    enabled: true,
    includeArticles: true,
    includeCategories: true,
    includeAuthors: true,
  },
  indexNow: {
    enabled: true,
    apiKey: '',
  },
  searchConsole: {
    autoSubmitSitemap: false,
  },
  comments: {
    autoApproveVerifiedReaders: false,
  },
  contentSeo: {
    minPublishScore: 0,
    warnPublishScore: 60,
    requireFocusKeyword: false,
    requireMetaOnPublish: true,
    requireCanonicalOnPublish: true,
    metaTitleTemplate: '{{title}} | {{siteName}}',
    metaDescriptionTemplate: '{{excerpt}}',
    categoryMetaTitleTemplate: '{{name}} Articles | {{siteName}}',
    categoryMetaDescriptionTemplate: '{{description}}',
    authorMetaTitleTemplate: '{{name}} | {{siteName}}',
    authorMetaDescriptionTemplate: '{{bio}}',
  },
  hreflang: {
    enabled: true,
    xDefaultLanguage: 'en',
    includeRegionalVariants: true,
  },
};

async function getOrCreateSeoSettings(tenantId) {
  if (!tenantId) {
    return { ...DEFAULTS, tenantId: null };
  }

  let doc = await SeoSettings.findOne({ tenantId });
  if (!doc) {
    doc = await SeoSettings.create({ tenantId, ...DEFAULTS });
  }
  return doc;
}

function toPublicSeoSettings(doc) {
  if (!doc || !doc.tenantId) {
    return { ...DEFAULTS };
  }
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    siteName: obj.siteName,
    siteUrl: obj.siteUrl,
    twitterHandle: obj.twitterHandle,
    googleSiteVerification: obj.googleSiteVerification,
    bingSiteVerification: obj.bingSiteVerification,
    sitemap: { ...DEFAULTS.sitemap, ...obj.sitemap },
    indexNow: { ...DEFAULTS.indexNow, ...obj.indexNow },
    searchConsole: { ...DEFAULTS.searchConsole, ...obj.searchConsole },
    comments: { ...DEFAULTS.comments, ...obj.comments },
    contentSeo: { ...DEFAULTS.contentSeo, ...obj.contentSeo },
    hreflang: { ...DEFAULTS.hreflang, ...(obj.hreflang || {}) },
    updatedAt: obj.updatedAt,
  };
}

module.exports = {
  SEO_SETTINGS_DEFAULTS: DEFAULTS,
  getOrCreateSeoSettings,
  toPublicSeoSettings,
};

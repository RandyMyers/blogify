const SeoSettings = require('../models/SeoSettings');

/**
 * Accept bare token, meta tag HTML, or google-site-verification=TOKEN paste.
 */
function normalizeSiteVerificationToken(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';

  const metaContent = value.match(/content\s*=\s*["']([^"']+)["']/i);
  if (metaContent?.[1]) return metaContent[1].trim();

  const eqForm = value.match(/google-site-verification\s*=\s*([^\s"'<>]+)/i);
  if (eqForm?.[1]) return eqForm[1].trim();

  if (!/[<>]/.test(value)) return value;

  return value.replace(/<[^>]*>/g, '').trim();
}

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
    googleSiteVerification: normalizeSiteVerificationToken(obj.googleSiteVerification),
    bingSiteVerification: normalizeSiteVerificationToken(obj.bingSiteVerification),
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
  normalizeSiteVerificationToken,
};

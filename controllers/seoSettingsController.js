const SeoSettings = require('../models/SeoSettings');
const { asyncHandler } = require('../middleware/errorHandler');
const { pingSearchEngines } = require('../utils/sitemapPing');

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
};

async function getOrCreateSettings(tenantId) {
  if (!tenantId) {
    return { ...DEFAULTS, tenantId: null };
  }

  let doc = await SeoSettings.findOne({ tenantId });
  if (!doc) {
    doc = await SeoSettings.create({ tenantId, ...DEFAULTS });
  }
  return doc;
}

function toPublicSettings(doc) {
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
    updatedAt: obj.updatedAt,
  };
}

/**
 * @route GET /api/admin/seo-settings
 */
exports.getSeoSettings = asyncHandler(async (req, res) => {
  const doc = await getOrCreateSettings(req.tenantId);
  res.json({
    success: true,
    data: toPublicSettings(doc),
  });
});

/**
 * @route PATCH /api/admin/seo-settings
 */
exports.updateSeoSettings = asyncHandler(async (req, res) => {
  if (!req.tenantId) {
    return res.status(400).json({
      success: false,
      message: 'Select a tenant before saving SEO settings',
    });
  }

  const doc = await getOrCreateSettings(req.tenantId);
  const body = req.body || {};

  if (body.siteName !== undefined) doc.siteName = body.siteName;
  if (body.siteUrl !== undefined) doc.siteUrl = String(body.siteUrl).replace(/\/$/, '');
  if (body.twitterHandle !== undefined) doc.twitterHandle = body.twitterHandle;
  if (body.googleSiteVerification !== undefined) doc.googleSiteVerification = body.googleSiteVerification;
  if (body.bingSiteVerification !== undefined) doc.bingSiteVerification = body.bingSiteVerification;

  if (body.sitemap && typeof body.sitemap === 'object') {
    Object.assign(doc.sitemap, body.sitemap);
  }
  if (body.indexNow && typeof body.indexNow === 'object') {
    Object.assign(doc.indexNow, body.indexNow);
  }
  if (body.searchConsole && typeof body.searchConsole === 'object') {
    Object.assign(doc.searchConsole, body.searchConsole);
  }

  doc.markModified('sitemap');
  doc.markModified('indexNow');
  doc.markModified('searchConsole');
  await doc.save();

  res.json({
    success: true,
    data: toPublicSettings(doc),
  });
});

/**
 * @route POST /api/admin/seo-settings/ping-sitemap
 */
exports.pingSitemap = asyncHandler(async (req, res) => {
  const doc = await getOrCreateSettings(req.tenantId);
  const siteUrl = doc.siteUrl || DEFAULTS.siteUrl;
  const result = await pingSearchEngines(siteUrl);

  res.json({
    success: true,
    data: result,
  });
});

module.exports.getOrCreateSeoSettings = getOrCreateSettings;
module.exports.toPublicSeoSettings = toPublicSettings;

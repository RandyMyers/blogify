const SeoSettings = require('../models/SeoSettings');
const { asyncHandler } = require('../middleware/errorHandler');
const { pingSearchEngines } = require('../utils/sitemapPing');
const {
  SEO_SETTINGS_DEFAULTS: DEFAULTS,
  getOrCreateSeoSettings: getOrCreateSettings,
  toPublicSeoSettings,
  normalizeSiteVerificationToken,
} = require('../utils/seoSettingsStore');

/**
 * @route GET /api/seo/public
 * Public SEO settings for client head tags (no auth).
 */
exports.getPublicSeoSettings = asyncHandler(async (req, res) => {
  const doc = await getOrCreateSettings(req.tenantId);
  const settings = toPublicSeoSettings(doc);
  res.json({
    success: true,
    data: {
      siteName: settings.siteName,
      siteUrl: settings.siteUrl,
      twitterHandle: settings.twitterHandle,
      googleSiteVerification: settings.googleSiteVerification,
      bingSiteVerification: settings.bingSiteVerification,
      hreflang: settings.hreflang,
    },
  });
});

/**
 * @route GET /api/admin/seo-settings
 */
exports.getSeoSettings = asyncHandler(async (req, res) => {
  const doc = await getOrCreateSettings(req.tenantId);
  res.json({
    success: true,
    data: toPublicSeoSettings(doc),
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
  if (body.googleSiteVerification !== undefined) {
    doc.googleSiteVerification = normalizeSiteVerificationToken(body.googleSiteVerification);
  }
  if (body.bingSiteVerification !== undefined) {
    doc.bingSiteVerification = normalizeSiteVerificationToken(body.bingSiteVerification);
  }

  if (body.sitemap && typeof body.sitemap === 'object') {
    Object.assign(doc.sitemap, body.sitemap);
  }
  if (body.indexNow && typeof body.indexNow === 'object') {
    Object.assign(doc.indexNow, body.indexNow);
  }
  if (body.searchConsole && typeof body.searchConsole === 'object') {
    Object.assign(doc.searchConsole, body.searchConsole);
  }
  if (body.comments && typeof body.comments === 'object') {
    Object.assign(doc.comments, body.comments);
  }
  if (body.contentSeo && typeof body.contentSeo === 'object') {
    Object.assign(doc.contentSeo, body.contentSeo);
  }
  if (body.hreflang && typeof body.hreflang === 'object') {
    Object.assign(doc.hreflang, body.hreflang);
  }

  doc.markModified('sitemap');
  doc.markModified('indexNow');
  doc.markModified('searchConsole');
  doc.markModified('comments');
  doc.markModified('contentSeo');
  doc.markModified('hreflang');
  await doc.save();

  res.json({
    success: true,
    data: toPublicSeoSettings(doc),
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
module.exports.toPublicSeoSettings = toPublicSeoSettings;

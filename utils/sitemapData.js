const Article = require('../models/Article');
const Category = require('../models/Category');
const Author = require('../models/Author');
const Region = require('../models/Region');
const { getOrCreateSeoSettings } = require('./seoSettingsStore');

async function getSitemapFlags(tenantId) {
  const settings = await getOrCreateSeoSettings(tenantId);
  const sitemap = settings.sitemap || {};
  return {
    enabled: sitemap.enabled !== false,
    includeArticles: sitemap.includeArticles !== false,
    includeCategories: sitemap.includeCategories !== false,
    includeAuthors: sitemap.includeAuthors !== false,
  };
}

/**
 * Build tenant-scoped sitemap catalog (articles) plus global categories/authors/regions.
 * Used by sitemap API and the client build script local fallback.
 */
async function buildSitemapData(tenantId) {
  const flags = await getSitemapFlags(tenantId);
  const tenantFilter = tenantId ? { tenantId } : {};

  const [articles, categories, authors, regions] = await Promise.all([
    flags.enabled && flags.includeArticles
      ? Article.find({ published: true, ...tenantFilter })
          .select('baseSlug defaultLanguage translations updatedAt publishedAt regionRestrictions isGlobal')
          .sort({ updatedAt: -1 })
          .limit(50000)
          .lean()
      : [],
    flags.enabled && flags.includeCategories
      ? Category.find({})
          .select('baseSlug defaultLanguage translations updatedAt')
          .sort({ updatedAt: -1 })
          .limit(50000)
          .lean()
      : [],
    flags.enabled && flags.includeAuthors
      ? Author.find({})
          .select('baseSlug defaultLanguage translations updatedAt')
          .sort({ updatedAt: -1 })
          .limit(50000)
          .lean()
      : [],
    Region.find({ isActive: true }).sort({ name: 1 }).lean(),
  ]);

  return { articles, categories, authors, regions };
}

module.exports = {
  buildSitemapData,
  getSitemapFlags,
};

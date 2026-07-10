const Article = require('../models/Article');
const Category = require('../models/Category');
const Author = require('../models/Author');
const { getOrCreateSeoSettings } = require('../controllers/seoSettingsController');

const tenantFilter = (req) => (req.tenantId ? { tenantId: req.tenantId } : {});

async function getSitemapFlags(req) {
  const settings = await getOrCreateSeoSettings(req.tenantId);
  const sitemap = settings.sitemap || {};
  return {
    enabled: sitemap.enabled !== false,
    includeArticles: sitemap.includeArticles !== false,
    includeCategories: sitemap.includeCategories !== false,
    includeAuthors: sitemap.includeAuthors !== false,
  };
}

/**
 * Lightweight JSON endpoints used by the frontend build script
 * to generate sitemap.xml. Filtered by tenant when x-tenant-slug or ?tenant= is set.
 */

// GET /api/sitemap-data/articles
const getArticlesForSitemap = async (req, res) => {
  try {
    const flags = await getSitemapFlags(req);
    if (!flags.enabled || !flags.includeArticles) {
      return res.json({ articles: [], tenant: req.tenantSlug || null });
    }

    const articles = await Article.find({ published: true, ...tenantFilter(req) })
      .select('baseSlug defaultLanguage translations updatedAt publishedAt regionRestrictions isGlobal')
      .sort({ updatedAt: -1 })
      .limit(50000);

    res.json({
      articles,
      tenant: req.tenantSlug || null,
    });
  } catch (error) {
    console.error('Error fetching articles for sitemap:', error);
    res.status(500).json({ message: 'Error fetching articles for sitemap' });
  }
};

// GET /api/sitemap-data/categories
const getCategoriesForSitemap = async (req, res) => {
  try {
    const flags = await getSitemapFlags(req);
    if (!flags.enabled || !flags.includeCategories) {
      return res.json({ categories: [], tenant: req.tenantSlug || null });
    }

    const categories = await Category.find({})
      .select('baseSlug defaultLanguage translations updatedAt')
      .sort({ updatedAt: -1 })
      .limit(50000);

    res.json({
      categories,
      tenant: req.tenantSlug || null,
    });
  } catch (error) {
    console.error('Error fetching categories for sitemap:', error);
    res.status(500).json({ message: 'Error fetching categories for sitemap' });
  }
};

// GET /api/sitemap-data/authors
const getAuthorsForSitemap = async (req, res) => {
  try {
    const flags = await getSitemapFlags(req);
    if (!flags.enabled || !flags.includeAuthors) {
      return res.json({ authors: [], tenant: req.tenantSlug || null });
    }

    const authors = await Author.find(tenantFilter(req))
      .select('baseSlug defaultLanguage translations updatedAt')
      .sort({ updatedAt: -1 })
      .limit(50000);

    res.json({
      authors,
      tenant: req.tenantSlug || null,
    });
  } catch (error) {
    console.error('Error fetching authors for sitemap:', error);
    res.status(500).json({ message: 'Error fetching authors for sitemap' });
  }
};

module.exports = {
  getArticlesForSitemap,
  getCategoriesForSitemap,
  getAuthorsForSitemap,
};

const { buildSitemapData } = require('../utils/sitemapData');

/**
 * Lightweight JSON endpoints used by the frontend build script
 * to generate sitemap.xml. Filtered by tenant when x-tenant-slug or ?tenant= is set.
 */

// GET /api/sitemap-data/articles
const getArticlesForSitemap = async (req, res) => {
  try {
    const { articles } = await buildSitemapData(req.tenantId);
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
    const { categories } = await buildSitemapData(req.tenantId);
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
    const { authors } = await buildSitemapData(req.tenantId);
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

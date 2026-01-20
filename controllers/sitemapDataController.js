const Article = require('../models/Article');
const Category = require('../models/Category');
const Author = require('../models/Author');

/**
 * Lightweight JSON endpoints used by the frontend build script
 * to generate sitemap.xml. These are NOT XML sitemaps and are not
 * exposed directly to search engines.
 */

// GET /api/sitemap-data/articles
const getArticlesForSitemap = async (req, res) => {
  try {
    const articles = await Article.find({ published: true })
      .select('baseSlug defaultLanguage translations updatedAt')
      .sort({ updatedAt: -1 })
      .limit(50000); // Google’s general upper limit per sitemap

    res.json({
      articles
    });
  } catch (error) {
    console.error('Error fetching articles for sitemap:', error);
    res.status(500).json({ message: 'Error fetching articles for sitemap' });
  }
};

// GET /api/sitemap-data/categories
const getCategoriesForSitemap = async (req, res) => {
  try {
    const categories = await Category.find({})
      .select('baseSlug defaultLanguage translations updatedAt')
      .sort({ updatedAt: -1 })
      .limit(50000);

    res.json({
      categories
    });
  } catch (error) {
    console.error('Error fetching categories for sitemap:', error);
    res.status(500).json({ message: 'Error fetching categories for sitemap' });
  }
};

// GET /api/sitemap-data/authors
const getAuthorsForSitemap = async (req, res) => {
  try {
    const authors = await Author.find({})
      .select('baseSlug defaultLanguage translations updatedAt')
      .sort({ updatedAt: -1 })
      .limit(50000);

    res.json({
      authors
    });
  } catch (error) {
    console.error('Error fetching authors for sitemap:', error);
    res.status(500).json({ message: 'Error fetching authors for sitemap' });
  }
};

module.exports = {
  getArticlesForSitemap,
  getCategoriesForSitemap,
  getAuthorsForSitemap
};


const express = require('express');
const router = express.Router();
const {
  generateSitemapIndex,
  generateMainSitemap,
  generateArticlesSitemap,
  generateCategoriesSitemap,
  generateAuthorsSitemap
} = require('../controllers/sitemapController');

// Public routes - no authentication required

// Sitemap index (main entry point)
router.get('/sitemap.xml', generateSitemapIndex);

// Individual sitemaps
router.get('/sitemap-main.xml', generateMainSitemap);
router.get('/sitemap-articles.xml', generateArticlesSitemap);
router.get('/sitemap-categories.xml', generateCategoriesSitemap);
router.get('/sitemap-authors.xml', generateAuthorsSitemap);

module.exports = router;


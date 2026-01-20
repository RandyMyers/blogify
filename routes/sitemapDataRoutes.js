const express = require('express');
const router = express.Router();

const {
  getArticlesForSitemap,
  getCategoriesForSitemap,
  getAuthorsForSitemap
} = require('../controllers/sitemapDataController');

// Public JSON endpoints used only by the frontend build script
router.get('/articles', getArticlesForSitemap);
router.get('/categories', getCategoriesForSitemap);
router.get('/authors', getAuthorsForSitemap);

module.exports = router;


const express = require('express');
const router = express.Router();
const {
  searchArticles,
  searchCategories,
  searchAuthors,
  globalSearch
} = require('../controllers/searchController');
const { detectRegion } = require('../middleware/detectRegion');

// Apply region detection to all routes
router.use(detectRegion);

// Public routes
router.get('/all', globalSearch);
router.get('/categories', searchCategories);
router.get('/authors', searchAuthors);
router.get('/', searchArticles);

module.exports = router;



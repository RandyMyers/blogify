const express = require('express');
const router = express.Router();
const {
  getStats,
  getTopCountries,
  getArticleViewsByCountry,
  getRecentVisitors,
  trackVisitor
} = require('../controllers/visitorController');
const { protect, isAdmin } = require('../middleware/auth');

// Public route - manual tracking
router.post('/track', trackVisitor);

// All other routes require admin authentication
router.use(protect);
router.use(isAdmin);

router.get('/stats', getStats);
router.get('/top-countries', getTopCountries);
router.get('/article/:articleId/countries', getArticleViewsByCountry);
router.get('/recent', getRecentVisitors);

module.exports = router;


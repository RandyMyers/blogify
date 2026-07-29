const express = require('express');
const router = express.Router();
const {
  getAllArticles,
  getAllArticlesAdmin,
  getArticleBySlug,
  getArticleById,
  getTopArticles,
  getPopularArticles,
  getTrendingArticles,
  getFeaturedArticle,
  createArticle,
  updateArticle,
  deleteArticle,
  trackView,
  analyzeArticleSeo,
} = require('../controllers/articleController');
const { trackOfferClick } = require('../controllers/offerClickController');
const { protect, isAdmin } = require('../middleware/auth');
const { detectRegion } = require('../middleware/detectRegion');
const { checkArticleAccess } = require('../middleware/checkArticleAccess');
const { validateCreateArticle, validateUpdateArticle, validateArticleId } = require('../middleware/validators/articleValidator');
const { validateArticlePublishSeo } = require('../middleware/validateArticlePublishSeo');

// Apply region detection to all routes
router.use(detectRegion);

// Public routes
router.get('/top', getTopArticles);
router.get('/popular', getPopularArticles);
router.get('/trending', getTrendingArticles);
router.get('/featured', getFeaturedArticle);
router.post('/offers/click', trackOfferClick);
// Track view (must be before /:slug route to avoid route conflict)
router.post('/:slug/view', trackView);
router.get('/:slug', checkArticleAccess, getArticleBySlug);
router.get('/', getAllArticles);

// Admin routes - protected (order matters: /admin/list before /admin/:id)
router.get('/admin/list', protect, isAdmin, getAllArticlesAdmin);
router.post('/admin/analyze-seo', protect, isAdmin, analyzeArticleSeo);
router.post('/', protect, isAdmin, validateCreateArticle, validateArticlePublishSeo, createArticle);
router.get('/admin/:id', protect, isAdmin, validateArticleId, getArticleById);
router.put('/:id', protect, isAdmin, validateUpdateArticle, validateArticlePublishSeo, updateArticle);
router.delete('/:id', protect, isAdmin, validateArticleId, deleteArticle);

module.exports = router;


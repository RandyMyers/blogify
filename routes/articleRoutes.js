const express = require('express');
const router = express.Router();
const {
  getAllArticles,
  getArticleBySlug,
  getArticleById,
  getTopArticles,
  getPopularArticles,
  getTrendingArticles,
  getFeaturedArticle,
  createArticle,
  updateArticle,
  deleteArticle,
  trackView
} = require('../controllers/articleController');
const { protect, isAdmin } = require('../middleware/auth');
const { detectRegion } = require('../middleware/detectRegion');
const { checkArticleAccess } = require('../middleware/checkArticleAccess');
const { validateCreateArticle, validateUpdateArticle, validateArticleId } = require('../middleware/validators/articleValidator');

// Apply region detection to all routes
router.use(detectRegion);

// Public routes
router.get('/top', getAllArticles); // Use getAllArticles with featured/trending filters
router.get('/popular', getAllArticles);
router.get('/trending', getAllArticles);
router.get('/featured', getAllArticles);
// Track view (must be before /:slug route to avoid route conflict)
router.post('/:slug/view', trackView);
router.get('/:slug', checkArticleAccess, getArticleBySlug);
router.get('/', getAllArticles);

// Admin routes - protected
router.post('/', protect, isAdmin, validateCreateArticle, createArticle);
router.get('/admin/:id', protect, isAdmin, validateArticleId, getArticleById);
router.put('/:id', protect, isAdmin, validateUpdateArticle, updateArticle);
router.delete('/:id', protect, isAdmin, validateArticleId, deleteArticle);

module.exports = router;


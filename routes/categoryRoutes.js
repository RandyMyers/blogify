const express = require('express');
const router = express.Router();
const {
  getAllCategories,
  getPopularCategories,
  getCategoryById,
  getCategoryBySlug,
  getCategoryArticles,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controllers/categoryController');
const { protect, isAdmin } = require('../middleware/auth');
const { detectRegion } = require('../middleware/detectRegion');
const { validateCreateCategory, validateUpdateCategory } = require('../middleware/validators/categoryValidator');

// Apply region detection to all routes
router.use(detectRegion);

// Public routes
router.get('/popular', getPopularCategories);
router.get('/:slug/articles', getCategoryArticles);
router.get('/:slug', getCategoryBySlug);
router.get('/', getAllCategories);

// Admin routes - protected (must be before public :slug route)
router.get('/admin/:id', protect, isAdmin, getCategoryById);
router.post('/', protect, isAdmin, validateCreateCategory, createCategory);
router.put('/:id', protect, isAdmin, validateUpdateCategory, updateCategory);
router.delete('/:id', protect, isAdmin, deleteCategory);

module.exports = router;


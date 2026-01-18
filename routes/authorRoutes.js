const express = require('express');
const router = express.Router();
const {
  getAllAuthors,
  getAuthorById,
  getAuthorBySlug,
  getAuthorArticles,
  createAuthor,
  updateAuthor,
  deleteAuthor
} = require('../controllers/authorController');
const { protect, isAdmin } = require('../middleware/auth');
const { detectRegion } = require('../middleware/detectRegion');
const { validateCreateAuthor, validateUpdateAuthor } = require('../middleware/validators/authorValidator');

// Apply region detection to all routes
router.use(detectRegion);

// Public routes
router.get('/:slug/articles', getAuthorArticles);
router.get('/:slug', getAuthorBySlug);
router.get('/', getAllAuthors);

// Admin routes - protected (must be before public :slug route)
router.get('/admin/:id', protect, isAdmin, getAuthorById);
router.post('/', protect, isAdmin, validateCreateAuthor, createAuthor);
router.put('/:id', protect, isAdmin, validateUpdateAuthor, updateAuthor);
router.delete('/:id', protect, isAdmin, deleteAuthor);

module.exports = router;


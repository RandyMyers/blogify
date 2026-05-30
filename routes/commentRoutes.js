const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  getArticleComments,
  createComment,
  getAdminStats,
  getAdminComments,
  getAdminComment,
  updateAdminComment,
  bulkUpdateAdminComments,
  deleteAdminComment,
  bulkDeleteAdminComments,
  exportAdminComments,
  getArticleCommentCounts,
  getAdminCommentUrls,
} = require('../controllers/commentController');
const { protect, isAdmin } = require('../middleware/auth');

const router = express.Router();

const commentPostLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many comments from this IP. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/admin/stats', protect, isAdmin, getAdminStats);
router.get('/admin/urls', protect, isAdmin, getAdminCommentUrls);
router.get('/admin/export', protect, isAdmin, exportAdminComments);
router.get('/admin/article/:articleId/counts', protect, isAdmin, getArticleCommentCounts);
router.patch('/admin/bulk/status', protect, isAdmin, bulkUpdateAdminComments);
router.delete('/admin/bulk', protect, isAdmin, bulkDeleteAdminComments);
router.get('/admin', protect, isAdmin, getAdminComments);
router.get('/admin/:id', protect, isAdmin, getAdminComment);
router.patch('/admin/:id', protect, isAdmin, updateAdminComment);
router.delete('/admin/:id', protect, isAdmin, deleteAdminComment);

router.get('/article/:articleId', getArticleComments);
router.post('/article/:articleId', commentPostLimiter, createComment);

module.exports = router;

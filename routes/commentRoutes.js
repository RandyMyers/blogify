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
  getAdminCommentSettings,
  updateAdminCommentSettings,
} = require('../controllers/commentController');
const { protect, isAdmin, authorize } = require('../middleware/auth');

const router = express.Router();

const commentPostLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => (req.user?._id ? `user:${req.user._id}` : req.ip),
  message: {
    success: false,
    message: 'Too many comments. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/admin/settings', protect, isAdmin, getAdminCommentSettings);
router.patch('/admin/settings', protect, isAdmin, updateAdminCommentSettings);
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
router.post('/article/:articleId', protect, authorize('reader'), commentPostLimiter, createComment);

module.exports = router;

const express = require('express');
const router = express.Router();
const {
  createMessage,
  getAllMessages,
  getMessage,
  markAsRead,
  markAsReplied,
  deleteMessage,
  getUnreadCount
} = require('../controllers/contactController');
const { protect, isAdmin } = require('../middleware/auth');
const { validateCreateMessage, validateMessageId } = require('../middleware/validators/contactValidator');

// Public routes
router.post('/', validateCreateMessage, createMessage);

// Admin routes - protected
router.get('/unread/count', protect, isAdmin, getUnreadCount);
router.get('/:id', protect, isAdmin, validateMessageId, getMessage);
router.put('/:id/read', protect, isAdmin, validateMessageId, markAsRead);
router.put('/:id/replied', protect, isAdmin, validateMessageId, markAsReplied);
router.delete('/:id', protect, isAdmin, validateMessageId, deleteMessage);
router.get('/', protect, isAdmin, getAllMessages);

module.exports = router;


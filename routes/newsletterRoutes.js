const express = require('express');
const router = express.Router();
const {
  subscribe,
  confirmSubscription,
  unsubscribe,
  getSubscribers,
  getSubscribersCount
} = require('../controllers/newsletterController');
const { protect, isAdmin } = require('../middleware/auth');
const { validateSubscribe, validateToken } = require('../middleware/validators/newsletterValidator');

// Public routes
router.post('/subscribe', validateSubscribe, subscribe);
router.get('/confirm/:token', validateToken, confirmSubscription);
router.get('/unsubscribe/:token', validateToken, unsubscribe);

// Admin routes - protected
router.get('/subscribers/count', protect, isAdmin, getSubscribersCount);
router.get('/subscribers', protect, isAdmin, getSubscribers);

module.exports = router;


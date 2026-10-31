const express = require('express');
const router = express.Router();
const {
  getActiveAds,
  getAdById,
  getAllAds,
  createAd,
  updateAd,
  deleteAd,
  trackImpression,
  trackClick,
  getAnalytics
} = require('../controllers/adController');
const { protect, isAdmin } = require('../middleware/auth');

// Public routes
router.get('/', getActiveAds);

// Admin routes (protected)
router.get('/admin/all', protect, isAdmin, getAllAds);
router.get('/admin/analytics', protect, isAdmin, getAnalytics);
router.post('/admin', protect, isAdmin, createAd);
router.put('/admin/:id', protect, isAdmin, updateAd);
router.delete('/admin/:id', protect, isAdmin, deleteAd);

// Public routes with path parameters must follow the admin paths.
router.get('/:id', getAdById);
router.post('/:id/impression', trackImpression);
router.post('/:id/click', trackClick);

module.exports = router;




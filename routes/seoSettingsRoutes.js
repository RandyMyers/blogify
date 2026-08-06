const express = require('express');
const router = express.Router();
const { protect, isAdmin } = require('../middleware/auth');
const {
  getSeoSettings,
  updateSeoSettings,
  pingSitemap,
  submitIndexNow,
} = require('../controllers/seoSettingsController');

router.use(protect, isAdmin);

router.get('/', getSeoSettings);
router.patch('/', updateSeoSettings);
router.post('/ping-sitemap', pingSitemap);
router.post('/indexnow-submit', submitIndexNow);

module.exports = router;

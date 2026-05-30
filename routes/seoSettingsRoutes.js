const express = require('express');
const router = express.Router();
const { protect, isAdmin } = require('../middleware/auth');
const {
  getSeoSettings,
  updateSeoSettings,
  pingSitemap,
} = require('../controllers/seoSettingsController');

router.use(protect, isAdmin);

router.get('/', getSeoSettings);
router.patch('/', updateSeoSettings);
router.post('/ping-sitemap', pingSitemap);

module.exports = router;

const express = require('express');
const router = express.Router();
const { getPublicSeoSettings } = require('../controllers/seoSettingsController');

router.get('/public', getPublicSeoSettings);

module.exports = router;

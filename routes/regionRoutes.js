const express = require('express');
const router = express.Router();
const {
  getAllRegions,
  getRegionByCode,
  setUserRegion,
  getRegionsByLanguage
} = require('../controllers/regionController');

// Public routes
// IMPORTANT: More specific routes must come before parameterized routes
router.get('/language/:lang', getRegionsByLanguage);
router.post('/set', setUserRegion);
router.get('/', getAllRegions); // Must come before /:code
router.get('/:code', getRegionByCode);

module.exports = router;




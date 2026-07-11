const express = require('express');
const router = express.Router();
const { getOverview, listOfferClicks } = require('../controllers/offerClickController');
const { protect, isAdmin } = require('../middleware/auth');

router.use(protect);
router.use(isAdmin);

router.get('/overview', getOverview);
router.get('/', listOfferClicks);

module.exports = router;

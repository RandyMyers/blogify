const express = require('express');
const router = express.Router();
const { protect, isAdmin } = require('../middleware/auth');
const {
  getEmailSettings,
  updateEmailSettings,
  testEmailSettings,
} = require('../controllers/emailSettingsController');

router.use(protect, isAdmin);

router.get('/', getEmailSettings);
router.patch('/', updateEmailSettings);
router.post('/test', testEmailSettings);

module.exports = router;

const express = require('express');
const router = express.Router();
const { login, getMe } = require('../controllers/authController');
const { protect, isAdmin } = require('../middleware/auth');
const { validateLogin } = require('../middleware/validators/authValidator');

// Admin login
router.post('/login', validateLogin, login);

// Get current authenticated admin user
router.get('/me', protect, isAdmin, getMe);

module.exports = router;




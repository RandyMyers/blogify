const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { login, getMe } = require('../controllers/authController');
const {
  registerReader,
  loginReader,
  getReaderMe,
  getReaderComments,
  updateReaderComment,
  deleteReaderComment,
  verifyReaderEmail,
  resendReaderVerification,
  forgotReaderPassword,
  resetReaderPassword,
} = require('../controllers/readerAuthController');
const { protect, isAdmin, authorize } = require('../middleware/auth');
const {
  validateLogin,
  validateReaderRegister,
  validateReaderLogin,
  validateVerifyEmail,
  validateForgotPassword,
  validateResetPassword,
} = require('../middleware/validators/authValidator');

const authEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin login
router.post('/login', validateLogin, login);

// Get current authenticated admin user
router.get('/me', protect, isAdmin, getMe);

// Reader auth (public site)
router.post('/reader/register', validateReaderRegister, registerReader);
router.post('/reader/login', validateReaderLogin, loginReader);
router.post('/reader/verify-email', validateVerifyEmail, verifyReaderEmail);
router.post('/reader/forgot-password', authEmailLimiter, validateForgotPassword, forgotReaderPassword);
router.post('/reader/reset-password', validateResetPassword, resetReaderPassword);
router.get('/reader/me', protect, authorize('reader'), getReaderMe);
router.post('/reader/resend-verification', protect, authorize('reader'), authEmailLimiter, resendReaderVerification);
router.get('/reader/comments', protect, authorize('reader'), getReaderComments);
router.patch('/reader/comments/:id', protect, authorize('reader'), updateReaderComment);
router.delete('/reader/comments/:id', protect, authorize('reader'), deleteReaderComment);

module.exports = router;

const express = require('express');
const router = express.Router();
const { uploadImage, uploadMultipleImages } = require('../controllers/uploadController');
const { protect, authorizeRoles } = require('../middleware/auth');

// Upload single image
router.post('/image', protect, authorizeRoles('admin'), uploadImage);

// Upload multiple images
router.post('/images', protect, authorizeRoles('admin'), uploadMultipleImages);

module.exports = router;



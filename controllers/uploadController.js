const { asyncHandler } = require('../middleware/errorHandler');
const { uploadToCloudinary } = require('../utils/cloudinaryUpload');
const logger = require('../utils/logger');

/**
 * @desc    Upload image to Cloudinary
 * @route   POST /api/upload/image
 * @access  Private/Admin
 */
exports.uploadImage = asyncHandler(async (req, res) => {
  // Check if file exists
  if (!req.files || !req.files.image) {
    return res.status(400).json({
      success: false,
      message: 'No image file provided',
    });
  }

  const file = req.files.image;

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.mimetype)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.',
    });
  }

  // Validate file size (10MB max)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return res.status(400).json({
      success: false,
      message: 'File size exceeds 10MB limit',
    });
  }

  try {
    // Get folder from query params (optional)
    const folder = req.query.folder || 'blogify';

    // Upload to Cloudinary
    const result = await uploadToCloudinary(file, {
      folder: folder,
      transformation: [
        {
          quality: 'auto',
          fetch_format: 'auto',
        },
      ],
    });

    res.json({
      success: true,
      data: {
        url: result.url,
        publicId: result.publicId,
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.bytes,
      },
    });
  } catch (error) {
    logger.error('Upload controller error:', {
      message: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip
    });
    
    // Better error message extraction
    let errorMessage = 'Failed to upload image';
    
    if (error.message && typeof error.message === 'string' && error.message.trim()) {
      errorMessage = error.message;
    } else if (error.http_code) {
      errorMessage = `Cloudinary error (${error.http_code}): ${error.message || 'Unknown error'}`;
    } else {
      errorMessage = 'Failed to upload image. Please check your Cloudinary configuration and try again.';
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
});

/**
 * @desc    Upload multiple images to Cloudinary
 * @route   POST /api/upload/images
 * @access  Private/Admin
 */
exports.uploadMultipleImages = asyncHandler(async (req, res) => {
  // Check if files exist
  if (!req.files || !req.files.images) {
    return res.status(400).json({
      success: false,
      message: 'No image files provided',
    });
  }

  const files = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
  const folder = req.query.folder || 'blogify';
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  const results = [];
  const errors = [];

  for (const file of files) {
    // Validate file type
    if (!allowedTypes.includes(file.mimetype)) {
      errors.push({
        filename: file.name,
        error: 'Invalid file type',
      });
      continue;
    }

    // Validate file size
    if (file.size > maxSize) {
      errors.push({
        filename: file.name,
        error: 'File size exceeds 10MB',
      });
      continue;
    }

    try {
      const result = await uploadToCloudinary(file, {
        folder: folder,
        transformation: [
          {
            quality: 'auto',
            fetch_format: 'auto',
          },
        ],
      });

      results.push({
        filename: file.name,
        url: result.url,
        publicId: result.publicId,
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.bytes,
      });
    } catch (error) {
      errors.push({
        filename: file.name,
        error: error.message,
      });
    }
  }

  res.json({
    success: errors.length === 0,
    count: results.length,
    data: results,
    errors: errors.length > 0 ? errors : undefined,
  });
});



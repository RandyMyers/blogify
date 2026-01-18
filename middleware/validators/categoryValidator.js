const { body, param, validationResult } = require('express-validator');
const { asyncHandler } = require('../errorHandler');
const mongoose = require('mongoose');

const SUPPORTED_LANGUAGES = ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'];
const VALID_COLORS = ['teal', 'coral', 'amber', 'violet', 'emerald', 'sky'];

/**
 * Validation middleware for creating categories
 */
exports.validateCreateCategory = [
  body('defaultLanguage')
    .optional()
    .isIn(SUPPORTED_LANGUAGES)
    .withMessage(`Language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}`),
  body('translations')
    .isObject()
    .withMessage('Translations object is required'),
  body('translations.*.name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Category name cannot be empty')
    .isLength({ max: 50 })
    .withMessage('Category name cannot exceed 50 characters'),
  body('translations.*.description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('color')
    .notEmpty()
    .withMessage('Color is required')
    .isIn(VALID_COLORS)
    .withMessage(`Color must be one of: ${VALID_COLORS.join(', ')}`),
  body('imageUrl')
    .optional()
    .isURL()
    .withMessage('Image URL must be a valid URL'),
  body('isPopular')
    .optional()
    .isBoolean()
    .withMessage('isPopular must be a boolean'),
  asyncHandler((req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  })
];

/**
 * Validation middleware for updating categories
 */
exports.validateUpdateCategory = [
  param('id')
    .notEmpty()
    .withMessage('Category ID is required')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid category ID format');
      }
      return true;
    }),
  body('translations')
    .optional()
    .isObject()
    .withMessage('Translations must be an object'),
  body('translations.*.name')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Category name cannot exceed 50 characters'),
  body('translations.*.description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('color')
    .optional()
    .isIn(VALID_COLORS)
    .withMessage(`Color must be one of: ${VALID_COLORS.join(', ')}`),
  body('imageUrl')
    .optional()
    .isURL()
    .withMessage('Image URL must be a valid URL'),
  body('isPopular')
    .optional()
    .isBoolean()
    .withMessage('isPopular must be a boolean'),
  asyncHandler((req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  })
];



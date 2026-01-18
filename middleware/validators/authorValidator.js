const { body, param, validationResult } = require('express-validator');
const { asyncHandler } = require('../errorHandler');
const mongoose = require('mongoose');

const SUPPORTED_LANGUAGES = ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'];

/**
 * Validation middleware for creating authors
 */
exports.validateCreateAuthor = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Author name is required')
    .isLength({ max: 100 })
    .withMessage('Author name cannot exceed 100 characters'),
  body('defaultLanguage')
    .optional()
    .isIn(SUPPORTED_LANGUAGES)
    .withMessage(`Language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}`),
  body('translations')
    .optional()
    .isObject()
    .withMessage('Translations must be an object'),
  body('translations.*.bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('avatar')
    .optional()
    .isURL()
    .withMessage('Avatar URL must be a valid URL'),
  body('socialLinks')
    .optional()
    .isObject()
    .withMessage('Social links must be an object'),
  body('socialLinks.twitter')
    .optional()
    .isURL()
    .withMessage('Twitter URL must be a valid URL'),
  body('socialLinks.linkedin')
    .optional()
    .isURL()
    .withMessage('LinkedIn URL must be a valid URL'),
  body('socialLinks.github')
    .optional()
    .isURL()
    .withMessage('GitHub URL must be a valid URL'),
  body('socialLinks.website')
    .optional()
    .isURL()
    .withMessage('Website URL must be a valid URL'),
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
 * Validation middleware for updating authors
 */
exports.validateUpdateAuthor = [
  param('id')
    .notEmpty()
    .withMessage('Author ID is required')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid author ID format');
      }
      return true;
    }),
  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Author name cannot exceed 100 characters'),
  body('translations')
    .optional()
    .isObject()
    .withMessage('Translations must be an object'),
  body('translations.*.bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('avatar')
    .optional()
    .isURL()
    .withMessage('Avatar URL must be a valid URL'),
  body('socialLinks')
    .optional()
    .isObject()
    .withMessage('Social links must be an object'),
  body('socialLinks.twitter')
    .optional()
    .isURL()
    .withMessage('Twitter URL must be a valid URL'),
  body('socialLinks.linkedin')
    .optional()
    .isURL()
    .withMessage('LinkedIn URL must be a valid URL'),
  body('socialLinks.github')
    .optional()
    .isURL()
    .withMessage('GitHub URL must be a valid URL'),
  body('socialLinks.website')
    .optional()
    .isURL()
    .withMessage('Website URL must be a valid URL'),
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



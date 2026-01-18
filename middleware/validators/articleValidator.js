const { body, param, query, validationResult } = require('express-validator');
const { asyncHandler } = require('../errorHandler');
const mongoose = require('mongoose');

// Supported languages
const SUPPORTED_LANGUAGES = ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'];

/**
 * Validation middleware for creating articles
 */
exports.validateCreateArticle = [
  body('defaultLanguage')
    .optional()
    .isIn(SUPPORTED_LANGUAGES)
    .withMessage(`Language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}`),
  body('translations')
    .isObject()
    .withMessage('Translations object is required'),
  body('translations.*.title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Title cannot be empty')
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  body('translations.*.excerpt')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Excerpt cannot exceed 500 characters'),
  body('translations.*.metaTitle')
    .optional()
    .trim()
    .isLength({ max: 60 })
    .withMessage('Meta title cannot exceed 60 characters'),
  body('translations.*.metaDescription')
    .optional()
    .trim()
    .isLength({ max: 160 })
    .withMessage('Meta description cannot exceed 160 characters'),
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid category ID format');
      }
      return true;
    }),
  body('author')
    .notEmpty()
    .withMessage('Author is required')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid author ID format');
      }
      return true;
    }),
  body('imageUrl')
    .notEmpty()
    .withMessage('Image URL is required')
    .isURL()
    .withMessage('Image URL must be a valid URL'),
  body('isGlobal')
    .optional()
    .isBoolean()
    .withMessage('isGlobal must be a boolean'),
  body('regionRestrictions')
    .optional()
    .isArray()
    .withMessage('regionRestrictions must be an array'),
  body('regionRestrictions.*')
    .optional()
    .isIn(['US', 'GB', 'CA', 'AU', 'FR', 'DE', 'ES', 'IT', 'PT', 'SE', 'NO', 'DK', 'FI', 'BE', 'NL', 'IE', 'LU', 'CH', 'AT'])
    .withMessage('Invalid region code'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters'),
  body('published')
    .optional()
    .isBoolean()
    .withMessage('Published must be a boolean'),
  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured must be a boolean'),
  body('trending')
    .optional()
    .isBoolean()
    .withMessage('Trending must be a boolean'),
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
 * Validation middleware for updating articles
 */
exports.validateUpdateArticle = [
  param('id')
    .notEmpty()
    .withMessage('Article ID is required')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid article ID format');
      }
      return true;
    }),
  body('translations')
    .optional()
    .isObject()
    .withMessage('Translations must be an object'),
  body('translations.*.title')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  body('translations.*.excerpt')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Excerpt cannot exceed 500 characters'),
  body('translations.*.metaTitle')
    .optional()
    .trim()
    .isLength({ max: 60 })
    .withMessage('Meta title cannot exceed 60 characters'),
  body('translations.*.metaDescription')
    .optional()
    .trim()
    .isLength({ max: 160 })
    .withMessage('Meta description cannot exceed 160 characters'),
  body('category')
    .optional()
    .custom((value) => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid category ID format');
      }
      return true;
    }),
  body('author')
    .optional()
    .custom((value) => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid author ID format');
      }
      return true;
    }),
  body('imageUrl')
    .optional()
    .isURL()
    .withMessage('Image URL must be a valid URL'),
  body('regionRestrictions')
    .optional()
    .isArray()
    .withMessage('regionRestrictions must be an array'),
  body('regionRestrictions.*')
    .optional()
    .isIn(['US', 'GB', 'CA', 'AU', 'FR', 'DE', 'ES', 'IT', 'PT', 'SE', 'NO', 'DK', 'FI', 'BE', 'NL', 'IE', 'LU', 'CH', 'AT'])
    .withMessage('Invalid region code'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters'),
  body('published')
    .optional()
    .isBoolean()
    .withMessage('Published must be a boolean'),
  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured must be a boolean'),
  body('trending')
    .optional()
    .isBoolean()
    .withMessage('Trending must be a boolean'),
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
 * Validation middleware for article ID parameter
 */
exports.validateArticleId = [
  param('id')
    .notEmpty()
    .withMessage('Article ID is required')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid article ID format');
      }
      return true;
    }),
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



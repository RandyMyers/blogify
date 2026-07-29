const { body, param, query, validationResult } = require('express-validator');
const { asyncHandler } = require('../errorHandler');
const mongoose = require('mongoose');
const { REGION_CODES } = require('../../constants/regions');

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
  body('translations.*.focusKeyword')
    .optional()
    .trim()
    .isLength({ max: 80 })
    .withMessage('Focus keyword cannot exceed 80 characters'),
  body('translations.*.canonicalUrl')
    .optional({ values: 'falsy' })
    .trim()
    .isURL()
    .withMessage('Canonical URL must be a valid URL'),
  body('translations.*.ogImage')
    .optional({ values: 'falsy' })
    .trim()
    .isURL()
    .withMessage('OG image URL must be a valid URL'),
  body('translations.*.ogTitle')
    .optional()
    .trim()
    .isLength({ max: 70 })
    .withMessage('OG title cannot exceed 70 characters'),
  body('translations.*.ogDescription')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('OG description cannot exceed 200 characters'),
  body('translations.*.twitterTitle')
    .optional()
    .trim()
    .isLength({ max: 70 })
    .withMessage('Twitter title cannot exceed 70 characters'),
  body('translations.*.twitterDescription')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Twitter description cannot exceed 200 characters'),
  body('translations.*.robots')
    .optional()
    .isIn(['index,follow', 'noindex,follow', 'index,nofollow', 'noindex,nofollow'])
    .withMessage('Invalid robots directive'),
  body('translations.*.offers')
    .optional()
    .isArray()
    .withMessage('Offers must be an array'),
  body('translations.*.offers.*.imageUrl')
    .optional({ values: 'falsy' })
    .trim()
    .isURL()
    .withMessage('Offer image URL must be a valid URL'),
  body('translations.*.offers.*.title')
    .optional()
    .trim()
    .isLength({ max: 120 })
    .withMessage('Offer title cannot exceed 120 characters'),
  body('translations.*.offers.*.description')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Offer description cannot exceed 300 characters'),
  body('translations.*.offers.*.url')
    .optional({ values: 'falsy' })
    .trim()
    .isURL()
    .withMessage('Offer URL must be a valid URL'),
  body('translations.*.offers.*.buttonLabel')
    .optional()
    .trim()
    .isLength({ max: 40 })
    .withMessage('Offer button label cannot exceed 40 characters'),
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
    .isIn(REGION_CODES)
    .withMessage('Invalid region code'),
  body('regionSlugs')
    .optional()
    .isObject()
    .withMessage('regionSlugs must be an object'),
  body('regionSlugs.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Region slug must be between 1 and 200 characters'),
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
  body('twitterCard')
    .optional()
    .isIn(['summary', 'summary_large_image'])
    .withMessage('Invalid Twitter card type'),
  body('articleSchema.publisher')
    .optional()
    .trim()
    .isLength({ max: 120 })
    .withMessage('Article publisher cannot exceed 120 characters'),
  body('articleSchema.articleSection')
    .optional()
    .trim()
    .isLength({ max: 120 })
    .withMessage('Article section cannot exceed 120 characters'),
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
  body('translations.*.focusKeyword')
    .optional()
    .trim()
    .isLength({ max: 80 })
    .withMessage('Focus keyword cannot exceed 80 characters'),
  body('translations.*.canonicalUrl')
    .optional({ values: 'falsy' })
    .trim()
    .isURL()
    .withMessage('Canonical URL must be a valid URL'),
  body('translations.*.ogImage')
    .optional({ values: 'falsy' })
    .trim()
    .isURL()
    .withMessage('OG image URL must be a valid URL'),
  body('translations.*.ogTitle')
    .optional()
    .trim()
    .isLength({ max: 70 })
    .withMessage('OG title cannot exceed 70 characters'),
  body('translations.*.ogDescription')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('OG description cannot exceed 200 characters'),
  body('translations.*.twitterTitle')
    .optional()
    .trim()
    .isLength({ max: 70 })
    .withMessage('Twitter title cannot exceed 70 characters'),
  body('translations.*.twitterDescription')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Twitter description cannot exceed 200 characters'),
  body('translations.*.robots')
    .optional()
    .isIn(['index,follow', 'noindex,follow', 'index,nofollow', 'noindex,nofollow'])
    .withMessage('Invalid robots directive'),
  body('translations.*.offers')
    .optional()
    .isArray()
    .withMessage('Offers must be an array'),
  body('translations.*.offers.*.imageUrl')
    .optional({ values: 'falsy' })
    .trim()
    .isURL()
    .withMessage('Offer image URL must be a valid URL'),
  body('translations.*.offers.*.title')
    .optional()
    .trim()
    .isLength({ max: 120 })
    .withMessage('Offer title cannot exceed 120 characters'),
  body('translations.*.offers.*.description')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Offer description cannot exceed 300 characters'),
  body('translations.*.offers.*.url')
    .optional({ values: 'falsy' })
    .trim()
    .isURL()
    .withMessage('Offer URL must be a valid URL'),
  body('translations.*.offers.*.buttonLabel')
    .optional()
    .trim()
    .isLength({ max: 40 })
    .withMessage('Offer button label cannot exceed 40 characters'),
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
    .isIn(REGION_CODES)
    .withMessage('Invalid region code'),
  body('regionSlugs')
    .optional()
    .isObject()
    .withMessage('regionSlugs must be an object'),
  body('regionSlugs.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Region slug must be between 1 and 200 characters'),
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
  body('twitterCard')
    .optional()
    .isIn(['summary', 'summary_large_image'])
    .withMessage('Invalid Twitter card type'),
  body('articleSchema.publisher')
    .optional()
    .trim()
    .isLength({ max: 120 })
    .withMessage('Article publisher cannot exceed 120 characters'),
  body('articleSchema.articleSection')
    .optional()
    .trim()
    .isLength({ max: 120 })
    .withMessage('Article section cannot exceed 120 characters'),
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



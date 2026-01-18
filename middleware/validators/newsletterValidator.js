const { body, param, validationResult } = require('express-validator');
const { asyncHandler } = require('../errorHandler');

/**
 * Validation middleware for newsletter subscription
 */
exports.validateSubscribe = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('region')
    .optional()
    .trim()
    .isLength({ max: 10 })
    .withMessage('Region code cannot exceed 10 characters'),
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
 * Validation middleware for newsletter token
 */
exports.validateToken = [
  param('token')
    .notEmpty()
    .withMessage('Token is required')
    .isLength({ min: 10 })
    .withMessage('Invalid token format'),
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



/**
 * Vercel serverless entry point.
 */
process.env.VERCEL = process.env.VERCEL || '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const app = require('../app');

module.exports = app;

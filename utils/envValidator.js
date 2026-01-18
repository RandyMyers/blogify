const logger = require('./logger');

/**
 * Validates required environment variables
 * @param {Object} config - Configuration object with required and optional vars
 * @returns {Object} - Validated environment variables
 */
function validateEnv(config = {}) {
  const {
    required = [],
    optional = [],
    defaults = {}
  } = config;

  const missing = [];
  const validated = {};

  // Check required variables
  for (const varName of required) {
    if (!process.env[varName]) {
      missing.push(varName);
    } else {
      validated[varName] = process.env[varName];
    }
  }

  // Check optional variables with defaults
  for (const varName of optional) {
    validated[varName] = process.env[varName] || defaults[varName];
  }

  if (missing.length > 0) {
    logger.error('Missing required environment variables:');
    missing.forEach(varName => {
      logger.error(`  - ${varName}`);
    });
    logger.error('\nPlease set these variables in your .env file');
    process.exit(1);
  }

  // Validate specific variables
  if (validated.JWT_SECRET && validated.JWT_SECRET.length < 32) {
    logger.warn('JWT_SECRET is less than 32 characters. Consider using a stronger secret.');
  }

  if (validated.MONGO_URL && !validated.MONGO_URL.startsWith('mongodb')) {
    logger.warn('MONGO_URL does not appear to be a valid MongoDB connection string');
  }

  return validated;
}

module.exports = { validateEnv };



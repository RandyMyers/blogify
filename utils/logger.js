const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Check if we're in a serverless environment (Vercel, AWS Lambda, etc.)
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.SERVERLESS;

// Try to create logs directory only if not in serverless environment
let canWriteFiles = false;
let logsDir;

if (!isServerless) {
  try {
    logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    // Test if we can write to the directory
    const testFile = path.join(logsDir, '.write-test');
    try {
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      canWriteFiles = true;
    } catch (err) {
      canWriteFiles = false;
    }
  } catch (err) {
    // Directory creation failed, probably read-only filesystem
    canWriteFiles = false;
  }
}

// Custom format to include request ID
const logFormat = winston.format.printf(({ level, message, timestamp, requestId, ...meta }) => {
  let log = `${timestamp} [${level}]`;
  if (requestId) {
    log += ` [${requestId}]`;
  }
  log += `: ${message}`;
  if (Object.keys(meta).length > 0) {
    log += ` ${JSON.stringify(meta)}`;
  }
  return log;
});

// Create transports array
const transports = [];

// Only add file transports if we can write files (not in serverless)
if (canWriteFiles && logsDir) {
  transports.push(
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error' 
    })
  );
  transports.push(
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log') 
    })
  );
}

// Always add console transport (works in all environments)
transports.push(
  new winston.transports.Console({
    format: winston.format.combine(
      process.env.NODE_ENV !== 'production' ? winston.format.colorize() : winston.format.simple(),
      winston.format.simple()
    )
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: transports
});

module.exports = logger;





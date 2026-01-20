const express = require('express');
const morgan = require('morgan');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const fileUpload = require('express-fileupload');

// Load .env file from root directory (parent of server directory) FIRST
// This must happen before any other requires that might use process.env
// Try root directory first, then server directory as fallback
const rootEnvPath = path.resolve(__dirname, '..', '.env');
const serverEnvPath = path.resolve(__dirname, '.env');

let envResult;
if (fs.existsSync(rootEnvPath)) {
  envResult = dotenv.config({ path: rootEnvPath });
} else if (fs.existsSync(serverEnvPath)) {
  envResult = dotenv.config({ path: serverEnvPath });
} else {
  // Try default location (current working directory)
  // Don't throw error if .env doesn't exist (normal for serverless environments like Vercel)
  envResult = dotenv.config();
}

// Only log error if .env file was expected but failed to load
// In serverless (Vercel, etc.), environment variables are set via dashboard, so .env may not exist
if (envResult.error && !process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME && !process.env.SERVERLESS) {
  // Only warn if not in serverless environment
  console.warn('Note: .env file not found. Environment variables should be set via your hosting platform.');
  console.warn('Tried paths:');
  console.warn('  -', rootEnvPath);
  console.warn('  -', serverEnvPath);
  console.warn('  -', path.resolve('.env'));
}

// Now require modules that might use process.env
const logger = require('./utils/logger');
const { validateEnv } = require('./utils/envValidator');
const authRoutes = require('./routes/authRoutes');

// Validate required environment variables
const env = validateEnv({
  required: [
    'MONGO_URL',
    'JWT_SECRET',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
  ],
  optional: [
    'NODE_ENV',
    'PORT',
    'CLIENT_URL',
    'ADMIN_URL',
    'JWT_EXPIRES_IN',
    'LOG_LEVEL',
    'ENABLE_JOBS'
  ],
  defaults: {
    NODE_ENV: 'development',
    PORT: 5000,
    LOG_LEVEL: 'info'
  }
});

const cloudinary = require('cloudinary').v2;
const requestId = require('./middleware/requestId');
const app = express();

// Trust proxy - important for getting real client IP behind reverse proxy/load balancer
// This allows req.ip to return the real client IP instead of proxy IP
app.set('trust proxy', true);

// Add request ID middleware early in the chain
app.use(requestId);

// --- CORS (Vercel-safe) ---
// On Vercel/serverless, you must respond to OPTIONS preflights and include CORS headers on every path,
// including error responses. We set headers early so they apply even if later middleware throws.
const isDevelopment = env.NODE_ENV !== 'production';

const isAllowedOrigin = (origin) => {
  if (!origin) return isDevelopment; // allow non-browser tools (no Origin) only in dev

  // Local dev
  if (isDevelopment && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
    return true;
  }

  // Explicit allowlist via env
  if (origin === env.CLIENT_URL || origin === env.ADMIN_URL) {
    return true;
  }

  // Hosting platforms
  if (origin.endsWith('.netlify.app') || origin.endsWith('.vercel.app')) {
    return true;
  }

  return false;
};

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    // Only set credentials if you actually use cookies; keep it true for now because server uses cookieParser.
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Always set these so preflight can succeed.
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Short-circuit preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return next();
});

// Cloudinary Configuration
const cloudinaryConfig = require('./config/cloudinary');

// Set Cloudinary configuration as a local variable
app.use((req, res, next) => {
  cloudinary.config(cloudinaryConfig);
  next();
});

// MongoDB connection

// MongoDB connection options with connection pooling
const mongoOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10, // Maximum number of connections in pool
  minPoolSize: 2, // Minimum number of connections in pool
  serverSelectionTimeoutMS: 5000, // How long to try connecting
  socketTimeoutMS: 45000, // How long to wait for a response
  family: 4 // Use IPv4, skip trying IPv6
};

mongoose.connect(env.MONGO_URL, mongoOptions)
  .then(() => {
    logger.info('Connected to MongoDB');
    logger.info(`Connection pool configured: min=${mongoOptions.minPoolSize}, max=${mongoOptions.maxPoolSize}`);
  })
  .catch((error) => {
    logger.error('Failed to connect to MongoDB', error);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1); // Exit if DB connection fails (except in test)
    }
  });

// Handle connection events
mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error closing MongoDB connection:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error closing MongoDB connection:', error);
    process.exit(1);
  }
});

// Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 50 : 5, // More lenient in development (50 attempts), strict in production (5 attempts)
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for localhost in development
    if (isDevelopment) {
      const ip = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
      return ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1';
    }
    return false;
  }
});

const allowedOrigins = [
  env.CLIENT_URL,
  env.ADMIN_URL,
  // Netlify URLs
  'https://fabulous-arithmetic-400162.netlify.app',
  // Always allow localhost in development
  ...(isDevelopment ? ['http://localhost:3000', 'http://localhost:3001'] : [])
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.) in development
    if (!origin && isDevelopment) {
      return callback(null, true);
    }
    
    // In development, allow localhost origins
    if (isDevelopment && origin && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
      return callback(null, true);
    }
    
    // Allow Netlify domains (including preview deployments)
    if (origin && (origin.includes('.netlify.app') || origin.includes('netlify.app'))) {
      return callback(null, true);
    }
    
    // Allow Vercel domains (in case admin is hosted there)
    if (origin && origin.includes('.vercel.app')) {
      return callback(null, true);
    }
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));
app.use(cookieParser()); // Parse cookies from requests
app.use(bodyParser.json({ limit: '10mb' })); // Adjust the limit as needed
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true })); 
app.use(morgan('dev'));

// Apply rate limiting
app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter); 

app.use(
  fileUpload({
    useTempFiles: true, // Store files in memory instead of a temporary directory
    createParentPath: true, // Create the 'uploads' directory if not exists
    tempFileDir: '/tmp/',
    limits: { fileSize: 10 * 1024 * 1024 }
  })
);

// Visitor tracking middleware (track all requests)
const { trackVisitor } = require('./middleware/visitorTracking');
app.use(trackVisitor);

// Legacy URL redirects (before API routes, but only for non-API paths)
// Note: This only applies to client-facing routes, not /api/* routes
app.use((req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return next();
  }
  // Apply redirect middleware for client routes
  const { redirectLegacyUrls } = require('./middleware/redirectLegacyUrls');
  return redirectLegacyUrls(req, res, next);
});

// CSRF protection (skip for API routes with Bearer tokens)
const { csrfProtection } = require('./middleware/csrf');
app.use(csrfProtection);

// CSRF token endpoint (for future cookie-based sessions)
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken ? req.csrfToken() : null });
});

// Health check endpoint (before rate limiting)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    environment: env.NODE_ENV
  });
});

// Using imported routes
app.use('/api/auth', authRoutes);

// Region routes (must be before other routes for region detection)
app.use('/api/regions', require('./routes/regionRoutes'));

// Upload routes
app.use('/api/upload', require('./routes/uploadRoutes'));

// Blog routes (only ones that exist in this project)
app.use('/api/articles', require('./routes/articleRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/authors', require('./routes/authorRoutes'));
app.use('/api/newsletter', require('./routes/newsletterRoutes'));
app.use('/api/contact', require('./routes/contactRoutes'));
app.use('/api/search', require('./routes/searchRoutes'));
app.use('/api/ads', require('./routes/adRoutes'));
app.use('/api/bookmarks', require('./routes/bookmarkRoutes'));
app.use('/api/visitors', require('./routes/visitorRoutes'));

// Sitemap routes (public, accessible at /sitemap.xml and /api/sitemap.xml)
app.use('/', require('./routes/sitemapRoutes'));
app.use('/api', require('./routes/sitemapRoutes'));

// Robots.txt route (public)
app.use('/', require('./routes/robots'));

// Error handling middleware (must be last)
const { errorHandler } = require('./middleware/errorHandler');
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Initialize scheduled jobs (only in production or when ENABLE_JOBS is true)
if (env.NODE_ENV === 'production' || env.ENABLE_JOBS === 'true') {
  try {
    const { initializeWalletScheduler } = require('./scheduler/walletScheduler');
    initializeWalletScheduler();
  } catch (error) {
    logger.warn('Could not initialize wallet scheduler:', error.message);
    logger.warn('Make sure node-cron is installed: npm install node-cron');
  }
}

// Start the server
const PORT = env.PORT;

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
    logger.info(`Environment: ${env.NODE_ENV}`);
  });
}

// Export app for testing
module.exports = app;

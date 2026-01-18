const Visitor = require('../models/Visitor');
// Logger is exported as the default export, not a named { logger }
const logger = require('../utils/logger');
const crypto = require('crypto');
const axios = require('axios');

// Try to load geoip-lite (optional dependency)
let geoip = null;
try {
  geoip = require('geoip-lite');
} catch (error) {
  logger.warn('geoip-lite not available, using API fallback for geolocation');
}

/**
 * Get client IP address from request
 * Handles proxy headers and localhost detection
 */
const getClientIP = (req) => {
  // Check proxy headers first (when behind reverse proxy/load balancer)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one (original client)
    const firstIP = forwardedFor.split(',')[0].trim();
    if (firstIP && firstIP !== '::1' && firstIP !== '127.0.0.1') {
      return firstIP;
    }
  }
  
  // Check other proxy headers
  const realIP = req.headers['x-real-ip'];
  if (realIP && realIP !== '::1' && realIP !== '127.0.0.1') {
    return realIP;
  }
  
  // Use Express's req.ip (requires trust proxy to be set)
  if (req.ip && req.ip !== '::1' && req.ip !== '127.0.0.1' && req.ip !== '::ffff:127.0.0.1') {
    return req.ip;
  }
  
  // Fallback to connection remote address
  const remoteAddress = req.connection?.remoteAddress || req.socket?.remoteAddress;
  if (remoteAddress && remoteAddress !== '::1' && remoteAddress !== '127.0.0.1') {
    // Remove IPv6 prefix if present
    return remoteAddress.replace('::ffff:', '');
  }
  
  // If all else fails, return unknown (will try to get public IP)
  return 'unknown';
};

/**
 * Get public IP address from external service
 * Used when localhost is detected
 */
const getPublicIP = async () => {
  try {
    const response = await axios.get('https://api.ipify.org?format=json', {
      timeout: 2000
    });
    return response.data?.ip || null;
  } catch (error) {
    // Try alternative service
    try {
      const response = await axios.get('https://api64.ipify.org?format=json', {
        timeout: 2000
      });
      return response.data?.ip || null;
    } catch (error2) {
      return null;
    }
  }
};

/**
 * Parse user agent to extract device, browser, and OS info
 */
const parseUserAgent = (userAgent) => {
  if (!userAgent) {
    return {
      device: 'unknown',
      browser: 'unknown',
      os: 'unknown'
    };
  }

  const ua = userAgent.toLowerCase();
  
  // Detect device
  let device = 'desktop';
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    device = 'mobile';
  } else if (/tablet|ipad|playbook|silk/i.test(ua)) {
    device = 'tablet';
  }
  
  // Detect browser
  let browser = 'unknown';
  if (ua.includes('chrome') && !ua.includes('edg')) {
    browser = 'chrome';
  } else if (ua.includes('firefox')) {
    browser = 'firefox';
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'safari';
  } else if (ua.includes('edg')) {
    browser = 'edge';
  } else if (ua.includes('opera') || ua.includes('opr')) {
    browser = 'opera';
  }
  
  // Detect OS
  let os = 'unknown';
  if (ua.includes('windows')) {
    os = 'windows';
  } else if (ua.includes('mac os') || ua.includes('macos')) {
    os = 'macos';
  } else if (ua.includes('linux')) {
    os = 'linux';
  } else if (ua.includes('android')) {
    os = 'android';
  } else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
    os = 'ios';
  }
  
  return { device, browser, os };
};

/**
 * Check if user agent is a bot
 */
const isBot = (userAgent) => {
  if (!userAgent) return false;
  
  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /scraper/i,
    /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i,
    /baiduspider/i, /yandexbot/i, /sogou/i, /exabot/i,
    /facebot/i, /ia_archiver/i
  ];
  
  return botPatterns.some(pattern => pattern.test(userAgent));
};

/**
 * Generate or get session ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object (optional, for setting cookies)
 * @returns {string} - Session ID
 */
const getSessionId = (req, res = null) => {
  // Try to get from cookie first
  if (req.cookies && req.cookies.sessionId) {
    return req.cookies.sessionId;
  }
  
  // Generate new session ID
  const sessionId = crypto.randomUUID();
  
  // Set cookie only if res is available and headers haven't been sent
  // This should only be called synchronously, not in async callbacks
  if (res && !res.headersSent) {
    try {
      res.cookie('sessionId', sessionId, {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
    } catch (error) {
      // Silently fail if we can't set cookie (headers already sent)
      logger.debug('Could not set session cookie', { error: error.message });
    }
  }
  
  return sessionId;
};

/**
 * Get location from IP using geoip-lite (offline) or API service (fallback)
 * Supports:
 * - geoip-lite (offline, free, basic location data)
 * - ip-api.com (free tier: 45 requests/minute, more detailed)
 */
const getLocationFromIP = async (ip) => {
  // Skip only if IP is truly unknown
  if (ip === 'unknown' || !ip) {
    return {
      country: null,
      region: null,
      city: null,
      latitude: null,
      longitude: null,
      timezone: null
    };
  }
  
  // Method 1: Use geoip-lite (offline, fast, basic data)
  // Note: This will return null for localhost/private IPs, but we try anyway
  if (geoip) {
    try {
      const geo = geoip.lookup(ip);
      if (geo) {
        return {
          country: geo.country || null,
          region: geo.region || null,
          city: geo.city || null,
          latitude: geo.ll ? geo.ll[0] : null,
          longitude: geo.ll ? geo.ll[1] : null,
          timezone: geo.timezone || null
        };
      }
    } catch (error) {
      logger.warn('Error using geoip-lite', { error: error.message, ip });
    }
  }
  
  // Method 2: Use ip-api.com API (free tier, more detailed, requires internet)
  if (process.env.USE_IP_API === 'true') {
    try {
      const response = await axios.get(`http://ip-api.com/json/${ip}`, {
        timeout: 3000,
        params: {
          fields: 'status,country,regionName,city,lat,lon,timezone'
        }
      });
      
      if (response.data && response.data.status === 'success') {
        return {
          country: response.data.country || null,
          region: response.data.regionName || null,
          city: response.data.city || null,
          latitude: response.data.lat || null,
          longitude: response.data.lon || null,
          timezone: response.data.timezone || null
        };
      }
    } catch (error) {
      // Silently fail - don't log API errors to avoid spam
      // logger.debug('Error using ip-api.com', { error: error.message, ip });
    }
  }
  
  // Return null if all methods fail
  return {
    country: null,
    region: null,
    city: null,
    latitude: null,
    longitude: null,
    timezone: null
  };
};

/**
 * Visitor tracking middleware
 * Tracks visitor information and stores it in the database
 */
const trackVisitor = async (req, res, next) => {
  // Skip tracking for certain paths
  const skipPaths = ['/api/health', '/api/metrics', '/favicon.ico', '/robots.txt'];
  if (skipPaths.some(path => req.path.startsWith(path))) {
    return next();
  }
  
  // Get session ID synchronously (before response is sent) so we can set cookie if needed
  const sessionId = getSessionId(req, res);
  
  // Don't block the request - track asynchronously
  setImmediate(async () => {
    try {
      let ip = getClientIP(req);
      const userAgent = req.headers['user-agent'] || '';
      const referrer = req.headers['referer'] || req.headers['referrer'] || null;
      const path = req.path;
      const query = req.query && Object.keys(req.query).length > 0 
        ? JSON.stringify(req.query) 
        : null;
      
      // If IP is localhost/unknown, try to get real public IP
      if (ip === 'unknown' || ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1') {
        const publicIP = await getPublicIP();
        if (publicIP) {
          ip = publicIP;
        }
      }
      
      // Skip bots if configured
      if (isBot(userAgent) && process.env.TRACK_BOTS !== 'true') {
        return;
      }
      
      const { device, browser, os } = parseUserAgent(userAgent);
      
      // Get location (async, but don't wait)
      const location = await getLocationFromIP(ip);
      
      // Extract article info if viewing an article
      let articleId = null;
      let articleSlug = null;
      
      // Check if this is an article view
      if (req.params && req.params.slug) {
        articleSlug = req.params.slug;
      } else if (req.body && req.body.articleId) {
        articleId = req.body.articleId;
      } else if (req.query && req.query.articleId) {
        articleId = req.query.articleId;
      }
      
      // Get user ID if authenticated
      const userId = req.user ? req.user._id : null;
      
      // Get language from headers or query
      const language = req.query.lang || 
                      req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 
                      'en';
      
      // Create visitor record
      await Visitor.create({
        ipAddress: ip,
        country: location.country,
        region: location.region,
        city: location.city,
        latitude: location.latitude,
        longitude: location.longitude,
        timezone: location.timezone,
        userAgent,
        referrer,
        path,
        query,
        articleId,
        articleSlug,
        sessionId,
        device,
        browser,
        os,
        userId,
        isBot: isBot(userAgent),
        language
      });
    } catch (error) {
      // Log error but don't break the request
      logger.error('Error tracking visitor', {
        error: error.message,
        stack: error.stack,
        requestId: req.requestId
      });
    }
  });
  
  next();
};

module.exports = {
  trackVisitor,
  getClientIP,
  getPublicIP,
  parseUserAgent,
  isBot,
  getSessionId,
  getLocationFromIP
};



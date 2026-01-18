const Region = require('../models/Region');

/**
 * Region detection middleware
 * Priority order:
 * 1. URL parameter (/:region) - e.g., /at/article/slug, /au/article/slug
 * 2. Query parameter (?region=AT)
 * 3. Cookie preference
 * 4. Browser language (Accept-Language header)
 * 5. IP geolocation (if enabled)
 * 6. Default (US/English)
 */
const detectRegion = async (req, res, next) => {
  let region = null;
  let language = null;
  
  try {
    // Priority 1: URL parameter (e.g., /at/article/slug, /au/article/slug)
    const urlRegion = req.params.region;
    if (urlRegion) {
      const regionFromUrl = await Region.findOne({ 
        code: urlRegion.toUpperCase(),
        isActive: true 
      });
      if (regionFromUrl) {
        region = regionFromUrl.code;
        language = regionFromUrl.defaultLanguage.toLowerCase();
      } else {
        // Region not found in our list - log warning and will default to US later
        console.warn(`Region ${urlRegion.toUpperCase()} not found in database, will default to US`);
      }
    }
    
    // Priority 2: Query parameter (?region=AT)
    if (!region && req.query.region) {
      const regionFromQuery = await Region.findOne({ 
        code: req.query.region.toUpperCase(),
        isActive: true 
      });
      if (regionFromQuery) {
        region = regionFromQuery.code;
        language = regionFromQuery.defaultLanguage.toLowerCase();
      }
    }
    
    // Priority 3: Cookie preference
    if (!region) {
      const cookieRegion = req.cookies?.region;
      if (cookieRegion) {
        const regionFromCookie = await Region.findOne({ 
          code: cookieRegion.toUpperCase(),
          isActive: true 
        });
        if (regionFromCookie) {
          region = regionFromCookie.code;
          language = regionFromCookie.defaultLanguage.toLowerCase();
        }
      }
    }
    
    // Priority 4: Browser language (Accept-Language header)
    if (!region) {
      const acceptLanguage = req.headers['accept-language'];
      if (acceptLanguage) {
        // Parse Accept-Language header (e.g., "en-US,en;q=0.9,fr;q=0.8")
        const languages = acceptLanguage
          .split(',')
          .map(lang => lang.split(';')[0].trim().toLowerCase().substring(0, 2));
        
        for (const lang of languages) {
          const regionFromBrowser = await Region.findOne({ 
            languages: lang,
            isActive: true 
          });
          if (regionFromBrowser) {
            region = regionFromBrowser.code;
            language = regionFromBrowser.defaultLanguage.toLowerCase();
            break;
          }
        }
      }
    }
    
    // Priority 5: IP geolocation (optional, requires geoip-lite package)
    if (!region && process.env.ENABLE_IP_GEOLOCATION === 'true') {
      try {
        const geoip = require('geoip-lite');
        const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
        if (ip) {
          const geo = geoip.lookup(ip);
          if (geo && geo.country) {
            const regionFromIP = await Region.findOne({ 
              code: geo.country,
              isActive: true 
            });
            if (regionFromIP) {
              region = regionFromIP.code;
              language = regionFromIP.defaultLanguage;
            }
          }
        }
      } catch (error) {
        // geoip-lite not installed or error, continue to default
        console.warn('IP geolocation not available:', error.message);
      }
    }
    
    // Priority 6: Default (US/English)
    if (!region) {
      const defaultRegion = await Region.findOne({ code: 'US', isActive: true });
      region = defaultRegion ? defaultRegion.code : 'US';
      language = 'en';
    }
    
    // Ensure language is set (should be set by now, but safety check)
    if (!language && region) {
      const regionDoc = await Region.findOne({ code: region, isActive: true });
      if (regionDoc) {
        language = regionDoc.defaultLanguage.toLowerCase();
      } else {
        language = 'en';
      }
    }
    
    // Attach to request object
    req.region = region;
    req.language = language;
    
    next();
  } catch (error) {
    console.error('Error in region detection:', error);
    // Fallback to default on error
    req.region = 'US';
    req.language = 'en';
    next();
  }
};

module.exports = { detectRegion };




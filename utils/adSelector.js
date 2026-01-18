const Ad = require('../models/Ad');

/**
 * Select active ads for a specific placement
 * @param {String} placement - Ad placement (header, sidebar, footer, etc.)
 * @param {String} region - Region code (US, GB, FR, etc.)
 * @param {String} language - Language code (en, fr, es, etc.)
 * @param {String} categoryId - Optional category ID for targeting
 * @param {Number} limit - Maximum number of ads to return (default: 5)
 * @returns {Promise<Array>} Array of ad documents
 */
async function selectAds(placement, region = 'US', language = 'en', categoryId = null, limit = 5) {
  const now = new Date();
  
  // Build base query for active ads
  const query = {
    placement,
    status: 'active',
    isActive: true
  };
  
  // Build $and array for complex conditions
  const andConditions = [];
  
  // Date conditions: startDate must be <= now or null, endDate must be >= now or null
  andConditions.push({
    $or: [
      { startDate: { $lte: now } },
      { startDate: null }
    ]
  });
  
  andConditions.push({
    $or: [
      { endDate: { $gte: now } },
      { endDate: null }
    ]
  });
  
  // Region targeting: if ad has no targetRegions (empty array), it targets all
  // Otherwise, it must include the requested region
  if (region) {
    andConditions.push({
      $or: [
        { targetRegions: { $size: 0 } }, // No targeting = all regions
        { targetRegions: region }
      ]
    });
  }
  
  // Language targeting: if ad has no targetLanguages (empty array), it targets all
  // Otherwise, it must include the requested language
  if (language) {
    andConditions.push({
      $or: [
        { targetLanguages: { $size: 0 } }, // No targeting = all languages
        { targetLanguages: language }
      ]
    });
  }
  
  // Category targeting: if ad has no targetCategories (empty array), it targets all
  // Otherwise, it must include the requested category
  if (categoryId) {
    andConditions.push({
      $or: [
        { targetCategories: { $size: 0 } }, // No targeting = all categories
        { targetCategories: categoryId }
      ]
    });
  }
  
  // Impression limits: maxImpressions must be null or impressions < maxImpressions
  andConditions.push({
    $or: [
      { maxImpressions: null },
      { $expr: { $lt: ['$impressions', '$maxImpressions'] } }
    ]
  });
  
  // Click limits: maxClicks must be null or clicks < maxClicks
  andConditions.push({
    $or: [
      { maxClicks: null },
      { $expr: { $lt: ['$clicks', '$maxClicks'] } }
    ]
  });
  
  // Add $and to query if we have conditions
  if (andConditions.length > 0) {
    query.$and = andConditions;
  }
  
  try {
    const ads = await Ad.find(query)
      .sort({ priority: -1, position: 1, createdAt: -1 })
      .limit(limit)
      .populate('targetCategories', 'name slug');
    
    // Additional filtering for targeting (double-check with model methods)
    const filteredAds = ads.filter(ad => {
      // Check if ad is currently active (considering dates and limits)
      if (!ad.isCurrentlyActive()) {
        return false;
      }
      
      // Check targeting with model method
      return ad.matchesTargeting(region, language, categoryId);
    });
    
    return filteredAds;
  } catch (error) {
    console.error('Error selecting ads:', error);
    return [];
  }
}

/**
 * Get a single random ad from selected ads (for rotation)
 * @param {Array} ads - Array of ad documents
 * @returns {Object|null} Random ad or null
 */
function selectRandomAd(ads) {
  if (!ads || ads.length === 0) {
    return null;
  }
  
  // If only one ad, return it
  if (ads.length === 1) {
    return ads[0];
  }
  
  // Weighted random selection based on priority
  // Higher priority = more likely to be selected
  const totalPriority = ads.reduce((sum, ad) => sum + (ad.priority || 0), 0);
  
  if (totalPriority === 0) {
    // If all priorities are 0, use equal probability
    const randomIndex = Math.floor(Math.random() * ads.length);
    return ads[randomIndex];
  }
  
  // Weighted selection
  let random = Math.random() * totalPriority;
  for (const ad of ads) {
    random -= (ad.priority || 0);
    if (random <= 0) {
      return ad;
    }
  }
  
  // Fallback to first ad
  return ads[0];
}

module.exports = {
  selectAds,
  selectRandomAd
};



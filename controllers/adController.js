const Ad = require('../models/Ad');
const { asyncHandler } = require('../middleware/errorHandler');
const { selectAds, selectRandomAd } = require('../utils/adSelector');

/**
 * @desc    Get active ads for a placement (public)
 * @route   GET /api/ads
 * @access  Public
 */
exports.getActiveAds = asyncHandler(async (req, res) => {
  const { placement, region, language, category } = req.query;
  
  // Validate required parameters
  if (!placement) {
    return res.status(400).json({
      success: false,
      message: 'Placement parameter is required'
    });
  }
  
  // Default values
  const targetRegion = region || 'US';
  const targetLanguage = language || 'en';
  const targetCategory = category || null;
  const limit = parseInt(req.query.limit) || 5;
  
  // Get ads
  const ads = await selectAds(placement, targetRegion, targetLanguage, targetCategory, limit);
  
  // Transform ads to include language-specific content
  const transformedAds = ads.map(ad => {
    const translation = ad.getTranslation(targetLanguage);
    const defaultTranslation = ad.getTranslation('en');
    const activeTranslation = translation || defaultTranslation;
    
    return {
      _id: ad._id,
      name: ad.name,
      type: ad.type,
      placement: ad.placement,
      clickUrl: ad.clickUrl,
      imageUrl: activeTranslation?.imageUrl || ad.imageUrl,
      htmlContent: activeTranslation?.htmlContent || ad.htmlContent,
      title: activeTranslation?.title || '',
      description: activeTranslation?.description || '',
      ctaText: activeTranslation?.ctaText || 'Learn More',
      priority: ad.priority,
      position: ad.position
    };
  });
  
  res.json({
    success: true,
    count: transformedAds.length,
    data: transformedAds
  });
});

/**
 * @desc    Get single ad by ID (public)
 * @route   GET /api/ads/:id
 * @access  Public
 */
exports.getAdById = asyncHandler(async (req, res) => {
  const ad = await Ad.findById(req.params.id)
    .populate('targetCategories', 'name slug')
    .populate('createdBy', 'name email');
  
  if (!ad) {
    return res.status(404).json({
      success: false,
      message: 'Ad not found'
    });
  }
  
  res.json({
    success: true,
    data: ad
  });
});

/**
 * @desc    Get all ads (admin)
 * @route   GET /api/ads/admin/all
 * @access  Private/Admin
 */
exports.getAllAds = asyncHandler(async (req, res) => {
  const {
    status,
    type,
    placement,
    search,
    page = 1,
    limit = 20
  } = req.query;
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Build query
  const query = {};
  
  if (status) {
    query.status = status;
  }
  
  if (type) {
    query.type = type;
  }
  
  if (placement) {
    query.placement = placement;
  }
  
  if (search) {
    query.name = { $regex: search, $options: 'i' };
  }
  
  const ads = await Ad.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('targetCategories', 'name slug')
    .populate('createdBy', 'name email');
  
  const total = await Ad.countDocuments(query);
  
  res.json({
    success: true,
    count: ads.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    data: ads
  });
});

/**
 * @desc    Create new ad (admin)
 * @route   POST /api/ads/admin
 * @access  Private/Admin
 */
exports.createAd = asyncHandler(async (req, res) => {
  const adData = {
    ...req.body,
    createdBy: req.user._id
  };
  
  const ad = await Ad.create(adData);
  
  res.status(201).json({
    success: true,
    data: ad
  });
});

/**
 * @desc    Update ad (admin)
 * @route   PUT /api/ads/admin/:id
 * @access  Private/Admin
 */
exports.updateAd = asyncHandler(async (req, res) => {
  let ad = await Ad.findById(req.params.id);
  
  if (!ad) {
    return res.status(404).json({
      success: false,
      message: 'Ad not found'
    });
  }
  
  // Update ad
  ad = await Ad.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );
  
  res.json({
    success: true,
    data: ad
  });
});

/**
 * @desc    Delete ad (admin)
 * @route   DELETE /api/ads/admin/:id
 * @access  Private/Admin
 */
exports.deleteAd = asyncHandler(async (req, res) => {
  const ad = await Ad.findById(req.params.id);
  
  if (!ad) {
    return res.status(404).json({
      success: false,
      message: 'Ad not found'
    });
  }
  
  await ad.deleteOne();
  
  res.json({
    success: true,
    message: 'Ad deleted successfully'
  });
});

/**
 * @desc    Track ad impression
 * @route   POST /api/ads/:id/impression
 * @access  Public
 */
exports.trackImpression = asyncHandler(async (req, res) => {
  const ad = await Ad.findById(req.params.id);
  
  if (!ad) {
    return res.status(404).json({
      success: false,
      message: 'Ad not found'
    });
  }
  
  // Increment impressions
  ad.impressions = (ad.impressions || 0) + 1;
  await ad.save();
  
  res.json({
    success: true,
    message: 'Impression tracked'
  });
});

/**
 * @desc    Track ad click
 * @route   POST /api/ads/:id/click
 * @access  Public
 */
exports.trackClick = asyncHandler(async (req, res) => {
  const ad = await Ad.findById(req.params.id);
  
  if (!ad) {
    return res.status(404).json({
      success: false,
      message: 'Ad not found'
    });
  }
  
  // Increment clicks
  ad.clicks = (ad.clicks || 0) + 1;
  await ad.save();
  
  res.json({
    success: true,
    message: 'Click tracked'
  });
});

/**
 * @desc    Get ad analytics (admin)
 * @route   GET /api/ads/admin/analytics
 * @access  Private/Admin
 */
exports.getAnalytics = asyncHandler(async (req, res) => {
  const { startDate, endDate, adId } = req.query;
  
  let query = {};
  
  if (adId) {
    query._id = adId;
  }
  
  const ads = await Ad.find(query);
  
  // Calculate totals
  const totalImpressions = ads.reduce((sum, ad) => sum + (ad.impressions || 0), 0);
  const totalClicks = ads.reduce((sum, ad) => sum + (ad.clicks || 0), 0);
  const averageCTR = totalImpressions > 0 
    ? ((totalClicks / totalImpressions) * 100).toFixed(2)
    : 0;
  
  // Get top performing ads
  const topAds = ads
    .map(ad => ({
      _id: ad._id,
      name: ad.name,
      impressions: ad.impressions || 0,
      clicks: ad.clicks || 0,
      ctr: ad.ctr || 0
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);
  
  res.json({
    success: true,
    data: {
      totalAds: ads.length,
      totalImpressions,
      totalClicks,
      averageCTR: parseFloat(averageCTR),
      topAds
    }
  });
});





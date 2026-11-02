const Ad = require('../models/Ad');
const AdEvent = require('../models/AdEvent');
const mongoose = require('mongoose');
const { asyncHandler } = require('../middleware/errorHandler');
const { scopedFilter } = require('../utils/tenantScope');
const { selectAds, selectRandomAd } = require('../utils/adSelector');
const { getCountryCodeFromIP } = require('../middleware/visitorTracking');
const { normalizeCountryCode } = require('../utils/adCountry');

const getRequestCountryCode = async (req) => {
  const ip = typeof req.ip === 'string' ? req.ip.replace(/^::ffff:/, '') : '';
  if (
    !ip ||
    ip === '::1' ||
    ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  ) {
    return 'unknown';
  }

  return normalizeCountryCode(getCountryCodeFromIP(ip)) || 'unknown';
};

const getPagePath = (value) => {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return null;
  }

  try {
    return new URL(value, 'https://blogify.invalid').pathname.slice(0, 500);
  } catch (error) {
    return null;
  }
};

/**
 * @desc    Get active ads for a placement (public)
 * @route   GET /api/ads
 * @access  Public
 */
exports.getActiveAds = asyncHandler(async (req, res) => {
  if (!req.tenantId) {
    return res.status(400).json({
      success: false,
      message: 'Tenant not resolved for this site',
    });
  }

  const { placement, region, language, category } = req.query;
  
  // Validate required parameters
  if (!placement) {
    return res.status(400).json({
      success: false,
      message: 'Placement parameter is required'
    });
  }
  
  // Default values
  const isGlobalAdPlacement = placement === 'popup' || placement === 'notification';
  const targetRegion = isGlobalAdPlacement ? await getRequestCountryCode(req) : (region || 'US');
  const targetLanguage = language || 'en';
  const targetCategory = category || null;
  const requestedLimit = parseInt(req.query.limit, 10) || 5;
  const limit = Math.min(Math.max(requestedLimit, 1), isGlobalAdPlacement ? 10 : 20);
  
  // Get ads
  const ads = await selectAds(placement, targetRegion, targetLanguage, targetCategory, limit, req.tenantId);
  
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
      message: activeTranslation?.message || '',
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
  const ad = await Ad.findOne({ _id: req.params.id, ...scopedFilter(req) })
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
  const query = { ...scopedFilter(req) };
  
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
    tenantId: req.tenantId,
    createdBy: req.user._id,
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
  let ad = await Ad.findOne({ _id: req.params.id, ...scopedFilter(req) });
  
  if (!ad) {
    return res.status(404).json({
      success: false,
      message: 'Ad not found'
    });
  }
  
  const updates = { ...req.body };
  delete updates._id;
  delete updates.tenantId;
  delete updates.createdBy;
  delete updates.impressions;
  delete updates.clicks;
  delete updates.dismissals;
  ad.set(updates);
  await ad.save();
  
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
  const ad = await Ad.findOne({ _id: req.params.id, ...scopedFilter(req) });
  
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
const recordAdEvent = async (req, res, eventType) => {
  const ad = await Ad.findOne({ _id: req.params.id, ...scopedFilter(req) });
  
  if (!ad) {
    return res.status(404).json({
      success: false,
      message: 'Ad not found'
    });
  }
  
  const countryCode = await getRequestCountryCode(req);
  const pagePath = getPagePath(req.body?.pagePath);
  const language = typeof req.body?.language === 'string'
    && /^[a-z]{2}$/i.test(req.body.language)
    ? req.body.language.toLowerCase()
    : 'en';
  const isGlobalAdPlacement = ad.placement === 'popup' || ad.placement === 'notification';
  const expectedFormatType = ad.placement === 'popup'
    ? 'image_popup'
    : ad.placement === 'notification'
      ? 'text_notification'
      : null;

  if (
    (eventType === 'dismissal' && !isGlobalAdPlacement)
    || !ad.isCurrentlyActive()
    || (expectedFormatType && ad.type !== expectedFormatType)
    || (isGlobalAdPlacement && !ad.matchesTargeting(countryCode, language))
  ) {
    return res.status(409).json({
      success: false,
      message: 'Ad is not currently eligible for this event',
    });
  }

  const eventId = typeof req.body?.eventId === 'string'
    && /^[a-zA-Z0-9_-]{16,100}$/.test(req.body.eventId)
    ? req.body.eventId
    : undefined;

  try {
    await AdEvent.create({
      adId: ad._id,
      type: eventType,
      eventId,
      tenantId: req.tenantId,
      countryCode,
      pagePath,
    });
  } catch (error) {
    if (error.code === 11000 && eventId) {
      return res.json({
        success: true,
        message: 'Event already tracked',
      });
    }
    throw error;
  }

  const counter = eventType === 'impression'
    ? 'impressions'
    : eventType === 'click'
      ? 'clicks'
      : 'dismissals';
  await Ad.updateOne({ _id: ad._id, ...scopedFilter(req) }, { $inc: { [counter]: 1 } });
  
  res.json({
    success: true,
    message: `${eventType} tracked`
  });
};

exports.trackImpression = asyncHandler(async (req, res) => {
  await recordAdEvent(req, res, 'impression');
});

/**
 * @desc    Track ad click
 * @route   POST /api/ads/:id/click
 * @access  Public
 */
exports.trackClick = asyncHandler(async (req, res) => {
  await recordAdEvent(req, res, 'click');
});

exports.trackDismissal = asyncHandler(async (req, res) => {
  await recordAdEvent(req, res, 'dismissal');
});

/**
 * @desc    Get ad analytics (admin)
 * @route   GET /api/ads/admin/analytics
 * @access  Private/Admin
 */
exports.getAnalytics = asyncHandler(async (req, res) => {
  const { adId } = req.query;
  const days = Math.min(parseInt(req.query.days, 10) || 30, 90);

  const adQuery = { ...scopedFilter(req), ...(adId ? { _id: adId } : {}) };
  const ads = await Ad.find(adQuery);

  const totalImpressions = ads.reduce((sum, ad) => sum + (ad.impressions || 0), 0);
  const totalClicks = ads.reduce((sum, ad) => sum + (ad.clicks || 0), 0);
  const totalDismissals = ads.reduce((sum, ad) => sum + (ad.dismissals || 0), 0);
  const averageCTR = totalImpressions > 0
    ? parseFloat(((totalClicks / totalImpressions) * 100).toFixed(2))
    : 0;

  const topAds = ads
    .map((ad) => ({
      _id: ad._id,
      name: ad.name,
      impressions: ad.impressions || 0,
      clicks: ad.clicks || 0,
      dismissals: ad.dismissals || 0,
      ctr: ad.impressions > 0 ? parseFloat(((ad.clicks / ad.impressions) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const eventMatch = { createdAt: { $gte: start }, ...scopedFilter(req) };
  if (adId) {
    eventMatch.adId = new mongoose.Types.ObjectId(adId);
  }

  const dailyRows = await AdEvent.aggregate([
    { $match: eventMatch },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          type: '$type',
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.date': 1 } },
  ]);

  const impressionsByDay = [];
  const clicksByDay = [];
  const dismissalsByDay = [];
  dailyRows.forEach((row) => {
    const point = { date: row._id.date, count: row.count };
    if (row._id.type === 'impression') impressionsByDay.push(point);
    if (row._id.type === 'click') clicksByDay.push(point);
    if (row._id.type === 'dismissal') dismissalsByDay.push(point);
  });

  const countryRows = await AdEvent.aggregate([
    { $match: { ...eventMatch, countryCode: { $type: 'string' } } },
    {
      $group: {
        _id: { countryCode: '$countryCode', type: '$type' },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  const countryTotals = new Map();
  countryRows.forEach((row) => {
    const countryCode = row._id.countryCode;
    const totals = countryTotals.get(countryCode) || {
      countryCode,
      impressions: 0,
      clicks: 0,
      dismissals: 0,
    };
    if (row._id.type === 'impression') totals.impressions = row.count;
    if (row._id.type === 'click') totals.clicks = row.count;
    if (row._id.type === 'dismissal') totals.dismissals = row.count;
    countryTotals.set(countryCode, totals);
  });
  const countryBreakdown = [...countryTotals.values()]
    .map((country) => ({
      ...country,
      ctr: country.impressions > 0
        ? parseFloat(((country.clicks / country.impressions) * 100).toFixed(2))
        : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions);

  res.json({
    success: true,
    data: {
      totalAds: ads.length,
      totalImpressions,
      totalClicks,
      totalDismissals,
      averageCTR,
      topAds,
      impressionsByDay,
      clicksByDay,
      dismissalsByDay,
      countryBreakdown,
      days,
    },
  });
});

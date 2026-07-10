const Visitor = require('../models/Visitor');
const { aggregateReferrerRows } = require('../utils/referrerSource');
const { scopedFilter } = require('../utils/tenantScope');
const { asyncHandler } = require('../middleware/errorHandler');
const { getClientIP, parseUserAgent, isBot, getLocationFromIP, getSessionId } = require('../middleware/visitorTracking');

/**
 * @desc    Get visitor statistics
 * @route   GET /api/visitors/stats
 * @access  Private/Admin
 */
exports.getStats = asyncHandler(async (req, res) => {
  const { articleId, startDate, endDate, country, excludeBots = true } = req.query;
  
  const filters = {};
  if (articleId) filters.articleId = articleId;
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;
  if (country) filters.country = country;
  filters.excludeBots = excludeBots !== 'false';
  
  const stats = await Visitor.getStats(filters);
  
  res.json({
    success: true,
    data: stats
  });
});

/**
 * @desc    Get top countries
 * @route   GET /api/visitors/top-countries
 * @access  Private/Admin
 */
exports.getTopCountries = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const { startDate, endDate, excludeBots = true } = req.query;
  
  const filters = {};
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;
  filters.excludeBots = excludeBots !== 'false';
  
  const countries = await Visitor.getTopCountries(limit, filters);
  
  res.json({
    success: true,
    count: countries.length,
    data: countries
  });
});

/**
 * @desc    Get article views by country
 * @route   GET /api/visitors/article/:articleId/countries
 * @access  Private/Admin
 */
exports.getArticleViewsByCountry = asyncHandler(async (req, res) => {
  const { articleId } = req.params;
  
  const views = await Visitor.getArticleViewsByCountry(articleId);
  
  res.json({
    success: true,
    count: views.length,
    data: views
  });
});

/**
 * @desc    Get recent visitors
 * @route   GET /api/visitors/recent
 * @access  Private/Admin
 */
exports.getRecentVisitors = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const skip = (page - 1) * limit;
  
  const { articleId, country, excludeBots = true } = req.query;
  
  const query = {};
  if (articleId) query.articleId = articleId;
  if (country) query.country = country;
  if (excludeBots !== 'false') query.isBot = false;
  
  const visitors = await Visitor.find(query)
    .sort({ visitedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('articleId', 'title slug imageUrl')
    .populate('userId', 'username email')
    .select('-__v');
  
  const total = await Visitor.countDocuments(query);
  
  res.json({
    success: true,
    count: visitors.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: visitors
  });
});

/**
 * @desc    Analytics overview (traffic, geography, top pages)
 * @route   GET /api/visitors/overview
 * @access  Private/Admin
 */
exports.getOverview = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
  const data = await Visitor.getAnalyticsOverview(days, req.tenantId);
  res.json({
    success: true,
    days,
    ...data,
    topReferrers: aggregateReferrerRows(data.topReferrers || []),
  });
});

/**
 * @desc    Live visitors (recent activity)
 * @route   GET /api/visitors/live
 * @access  Private/Admin
 */
exports.getLiveActivity = asyncHandler(async (req, res) => {
  const minutes = Math.min(Math.max(parseInt(req.query.minutes, 10) || 5, 1), 60);
  const data = await Visitor.getLiveActivity(minutes, req.tenantId);
  res.json({ success: true, data });
});

/**
 * @desc    Aggregated unique visitors list
 * @route   GET /api/visitors/aggregated
 * @access  Private/Admin
 */
exports.getAggregatedVisitors = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 500, 1000);
  const skip = parseInt(req.query.skip, 10) || 0;
  const { country, device } = req.query;
  const result = await Visitor.listAggregatedVisitors({ limit, skip, country, device, tenantId: req.tenantId });
  res.json({
    success: true,
    visitors: result.visitors,
    total: result.total,
  });
});

/**
 * @desc    Device breakdown
 * @route   GET /api/visitors/devices
 * @access  Private/Admin
 */
exports.getDeviceBreakdown = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days, 10) || 30;
  const data = await Visitor.getDeviceBreakdown(days, req.tenantId);
  res.json({ success: true, data });
});

/**
 * @desc    Track visitor manually (for explicit tracking)
 * @route   POST /api/visitors/track
 * @access  Public
 */
exports.trackVisitor = asyncHandler(async (req, res) => {
  const ip = getClientIP(req);
  const userAgent = req.headers['user-agent'] || '';
  const headerReferrer = req.headers['referer'] || req.headers['referrer'] || null;
  const { articleId, articleSlug, path, query: queryParams, referrer: bodyReferrer } = req.body || {};
  const referrer = bodyReferrer || headerReferrer || null;
  
  // Skip bots
  if (isBot(userAgent) && process.env.TRACK_BOTS !== 'true') {
    return res.json({
      success: true,
      message: 'Bot detected, not tracked'
    });
  }
  
  const { device, browser, os } = parseUserAgent(userAgent);
  const location = await getLocationFromIP(ip);
  
  const userId = req.user ? req.user._id : null;
  const language = req.query.lang || 
                  req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 
                  'en';
  
  const sessionId = getSessionId(req, res);

  const visitor = await Visitor.create({
    tenantId: req.tenantId,
    ipAddress: ip,
    country: location.country,
    region: location.region,
    city: location.city,
    latitude: location.latitude,
    longitude: location.longitude,
    timezone: location.timezone,
    userAgent,
    referrer,
    path: path || req.path,
    query: queryParams ? JSON.stringify(queryParams) : null,
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
  
  res.status(201).json({
    success: true,
    message: 'Visitor tracked successfully',
    data: visitor
  });
});



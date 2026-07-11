const mongoose = require('mongoose');
const Article = require('../models/Article');
const ArticleOfferClick = require('../models/ArticleOfferClick');
const { asyncHandler } = require('../middleware/errorHandler');
const { scopedFilter } = require('../utils/tenantScope');
const {
  getClientIP,
  getSessionId,
  isBot,
  getLocationFromIP,
} = require('../middleware/visitorTracking');

function buildSinceDate(days) {
  const d = Math.min(Math.max(parseInt(days, 10) || 30, 1), 365);
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000);
}

function uniqueVisitorExpr() {
  return {
    $cond: [
      { $and: [{ $ne: ['$sessionId', ''] }, { $ne: ['$sessionId', null] }] },
      '$sessionId',
      '$ipAddress',
    ],
  };
}

function groupedOffersPipeline(match, { sortField = 'totalClicks', sortDir = -1, skip = 0, limit = 20 } = {}) {
  const sort = { [sortField]: sortDir };
  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: {
          articleId: '$articleId',
          offerId: '$offerId',
          language: '$language',
          offerUrl: '$offerUrl',
          offerTitle: '$offerTitle',
        },
        totalClicks: { $sum: 1 },
        uniqueVisitors: { $addToSet: uniqueVisitorExpr() },
        lastClickAt: { $max: '$createdAt' },
      },
    },
    {
      $project: {
        _id: 0,
        articleId: '$_id.articleId',
        offerId: '$_id.offerId',
        language: '$_id.language',
        offerUrl: '$_id.offerUrl',
        offerTitle: '$_id.offerTitle',
        totalClicks: 1,
        uniqueClicks: { $size: '$uniqueVisitors' },
        lastClickAt: 1,
      },
    },
    { $sort: sort },
  ];

  if (skip) pipeline.push({ $skip: skip });
  if (limit) pipeline.push({ $limit: limit });

  return pipeline;
}

async function attachArticleTitles(rows = []) {
  const ids = [...new Set(rows.map((r) => String(r.articleId)).filter(Boolean))];
  if (!ids.length) return rows;

  const articles = await Article.find({ _id: { $in: ids } })
    .select('_id baseSlug defaultLanguage translations title')
    .lean();

  const titleById = {};
  articles.forEach((article) => {
    const lang = article.defaultLanguage || 'en';
    titleById[String(article._id)] =
      article.translations?.[lang]?.title || article.title || article.baseSlug || 'Article';
  });

  return rows.map((row) => ({
    ...row,
    articleTitle: titleById[String(row.articleId)] || 'Article',
  }));
}

/**
 * @route POST /api/articles/offers/click
 */
exports.trackOfferClick = asyncHandler(async (req, res) => {
  const { articleId, offerId, language, url, title } = req.body || {};
  const lang = String(language || req.language || 'en').toLowerCase();

  if (!articleId || !mongoose.Types.ObjectId.isValid(articleId)) {
    return res.status(400).json({ success: false, message: 'Valid articleId is required' });
  }

  const userAgent = req.headers['user-agent'] || '';
  if (isBot(userAgent)) {
    return res.json({ success: true, message: 'Ignored bot click' });
  }

  const article = await Article.findOne({
    _id: articleId,
    ...scopedFilter(req),
    published: true,
  }).select('translations tenantId');

  if (!article) {
    return res.status(404).json({ success: false, message: 'Article not found' });
  }

  const translation = article.translations?.[lang];
  const offers = Array.isArray(translation?.offers) ? translation.offers : [];
  const normalizedOfferId = String(offerId || '').trim();
  const matchedOffer = offers.find((o) => String(o._id) === normalizedOfferId);

  const offerUrl = String(url || matchedOffer?.url || '').trim();
  const offerTitle = String(title || matchedOffer?.title || '').trim();

  if (!offerUrl) {
    return res.status(400).json({ success: false, message: 'Offer URL is required' });
  }

  const ipAddress = getClientIP(req);
  const sessionId = getSessionId(req, res);
  let country = '';
  try {
    const loc = await getLocationFromIP(ipAddress);
    country = loc?.country || '';
  } catch {
    /* ignore geo errors */
  }

  await ArticleOfferClick.create({
    tenantId: req.tenantId || article.tenantId,
    articleId: article._id,
    offerId: normalizedOfferId || offerUrl,
    language: lang,
    offerTitle,
    offerUrl,
    sessionId,
    ipAddress,
    userAgent,
    country,
    referrer: req.headers.referer || req.headers.referrer || '',
  });

  res.json({ success: true, message: 'Offer click tracked' });
});

/**
 * @route GET /api/offer-clicks/overview
 */
exports.getOverview = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days, 10) || 30;
  const since = buildSinceDate(days);
  const match = { ...scopedFilter(req), createdAt: { $gte: since } };

  const [totalsAgg, topOffers] = await Promise.all([
    ArticleOfferClick.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalClicks: { $sum: 1 },
          uniqueVisitors: { $addToSet: uniqueVisitorExpr() },
        },
      },
      {
        $project: {
          _id: 0,
          totalClicks: 1,
          uniqueClicks: { $size: '$uniqueVisitors' },
        },
      },
    ]),
    ArticleOfferClick.aggregate(groupedOffersPipeline(match, { sortField: 'totalClicks', sortDir: -1, skip: 0, limit: 10 })),
  ]);

  const totals = totalsAgg[0] || { totalClicks: 0, uniqueClicks: 0 };
  const top = await attachArticleTitles(topOffers);

  res.json({
    success: true,
    data: {
      days,
      totals,
      topOffers: top,
    },
  });
});

/**
 * @route GET /api/offer-clicks
 */
exports.listOfferClicks = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days, 10) || 30;
  const since = buildSinceDate(days);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;
  const language = String(req.query.language || '').trim().toLowerCase();
  const articleId = String(req.query.articleId || '').trim();
  const search = String(req.query.search || '').trim();
  const sortField = ['totalClicks', 'uniqueClicks', 'lastClickAt', 'offerTitle'].includes(req.query.sort)
    ? req.query.sort
    : 'totalClicks';
  const sortDir = req.query.dir === 'asc' ? 1 : -1;

  const match = { ...scopedFilter(req), createdAt: { $gte: since } };
  if (language) match.language = language;
  if (articleId && mongoose.Types.ObjectId.isValid(articleId)) {
    match.articleId = new mongoose.Types.ObjectId(articleId);
  }

  const basePipeline = [
    { $match: match },
    {
      $group: {
        _id: {
          articleId: '$articleId',
          offerId: '$offerId',
          language: '$language',
          offerUrl: '$offerUrl',
          offerTitle: '$offerTitle',
        },
        totalClicks: { $sum: 1 },
        uniqueVisitors: { $addToSet: uniqueVisitorExpr() },
        lastClickAt: { $max: '$createdAt' },
      },
    },
    {
      $project: {
        _id: 0,
        articleId: '$_id.articleId',
        offerId: '$_id.offerId',
        language: '$_id.language',
        offerUrl: '$_id.offerUrl',
        offerTitle: '$_id.offerTitle',
        totalClicks: 1,
        uniqueClicks: { $size: '$uniqueVisitors' },
        lastClickAt: 1,
      },
    },
  ];

  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    basePipeline.push({
      $match: {
        $or: [{ offerTitle: regex }, { offerUrl: regex }],
      },
    });
  }

  const countPipeline = [...basePipeline, { $count: 'total' }];
  const dataPipeline = [
    ...basePipeline,
    { $sort: { [sortField]: sortDir } },
    { $skip: skip },
    { $limit: limit },
  ];

  const [countResult, rows] = await Promise.all([
    ArticleOfferClick.aggregate(countPipeline),
    ArticleOfferClick.aggregate(dataPipeline),
  ]);

  const total = countResult[0]?.total || 0;
  const offers = await attachArticleTitles(rows);

  res.json({
    success: true,
    page,
    limit,
    total,
    days,
    data: offers,
  });
});

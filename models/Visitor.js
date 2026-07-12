const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true,
  },
  // IP and Location
  ipAddress: {
    type: String,
    required: true,
    index: true
  },
  country: {
    type: String,
    uppercase: true,
    index: true
  },
  region: {
    type: String
  },
  city: {
    type: String
  },
  latitude: {
    type: Number
  },
  longitude: {
    type: Number
  },
  timezone: {
    type: String
  },
  
  // Request details
  userAgent: {
    type: String
  },
  referrer: {
    type: String
  },
  path: {
    type: String,
    index: true
  },
  query: {
    type: String
  },
  
  // Content tracking
  articleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    index: true
  },
  articleSlug: {
    type: String,
    index: true
  },
  
  // Session tracking
  sessionId: {
    type: String,
    index: true
  },
  
  // Device and browser info
  device: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet', 'unknown']
  },
  browser: {
    type: String
  },
  os: {
    type: String
  },
  
  // User info (if authenticated)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    default: null
  },
  
  // Timestamps
  visitedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Additional metadata
  isBot: {
    type: Boolean,
    default: false,
    index: true
  },
  language: {
    type: String,
    default: 'en'
  }
}, {
  timestamps: true
});

// Indexes for common queries
visitorSchema.index({ visitedAt: -1 });
visitorSchema.index({ articleId: 1, visitedAt: -1 });
visitorSchema.index({ country: 1, visitedAt: -1 });
visitorSchema.index({ userId: 1, visitedAt: -1 });
visitorSchema.index({ sessionId: 1, visitedAt: -1 });
visitorSchema.index({ ipAddress: 1, visitedAt: -1 });

// Compound indexes
visitorSchema.index({ articleId: 1, country: 1 });
visitorSchema.index({ visitedAt: -1, country: 1 });

// Static method to get visitor statistics
visitorSchema.statics.getStats = async function(filters = {}) {
  const matchStage = {};
  
  if (filters.articleId) {
    matchStage.articleId = new mongoose.Types.ObjectId(filters.articleId);
  }
  
  if (filters.startDate || filters.endDate) {
    matchStage.visitedAt = {};
    if (filters.startDate) {
      matchStage.visitedAt.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      matchStage.visitedAt.$lte = new Date(filters.endDate);
    }
  }
  
  if (filters.country) {
    matchStage.country = filters.country;
  }
  
  if (filters.excludeBots !== false) {
    matchStage.isBot = false;
  }
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalVisits: { $sum: 1 },
        uniqueIPs: { $addToSet: '$ipAddress' },
        countries: { $addToSet: '$country' },
        articles: { $addToSet: '$articleId' }
      }
    },
    {
      $project: {
        totalVisits: 1,
        uniqueIPs: { $size: '$uniqueIPs' },
        countries: { $size: '$countries' },
        uniqueArticles: { $size: '$articles' }
      }
    }
  ]);
  
  return stats[0] || {
    totalVisits: 0,
    uniqueIPs: 0,
    countries: 0,
    uniqueArticles: 0
  };
};

// Static method to get top countries
visitorSchema.statics.getTopCountries = async function(limit = 10, filters = {}) {
  const matchStage = {};
  
  if (filters.startDate || filters.endDate) {
    matchStage.visitedAt = {};
    if (filters.startDate) {
      matchStage.visitedAt.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      matchStage.visitedAt.$lte = new Date(filters.endDate);
    }
  }
  
  if (filters.excludeBots !== false) {
    matchStage.isBot = false;
  }
  
  return await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$country',
        count: { $sum: 1 },
        uniqueIPs: { $addToSet: '$ipAddress' }
      }
    },
    {
      $project: {
        country: '$_id',
        count: 1,
        uniqueIPs: { $size: '$uniqueIPs' }
      }
    },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
};

function botFilter(excludeBots = true) {
  return excludeBots ? { isBot: false } : {};
}

function tenantMatch(tenantId) {
  return tenantId ? { tenantId } : {};
}

function dateRangeMatch(days) {
  const start = new Date();
  start.setDate(start.getDate() - Number(days || 30));
  start.setHours(0, 0, 0, 0);
  return { visitedAt: { $gte: start } };
}

// Analytics overview for admin dashboard (coupondealz-style)
visitorSchema.statics.getAnalyticsOverview = async function (days = 30, tenantId = null) {
  const periodMatch = { ...botFilter(), ...dateRangeMatch(days), ...tenantMatch(tenantId) };
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    periodStats,
    stats24h,
    stats7d,
    allTimeVisitors,
    viewsByDay,
    topPages,
    countriesByActivity,
    countriesByVisitor,
    topReferrers,
  ] = await Promise.all([
    this.aggregate([
      { $match: periodMatch },
      {
        $group: {
          _id: null,
          pageViews: { $sum: 1 },
          uniqueSessions: { $addToSet: '$sessionId' },
          uniqueIPs: { $addToSet: '$ipAddress' },
        },
      },
      {
        $project: {
          pageViews: 1,
          uniqueVisitors: {
            $size: {
              $filter: {
                input: '$uniqueSessions',
                as: 's',
                cond: { $and: [{ $ne: ['$$s', null] }, { $ne: ['$$s', ''] }] },
              },
            },
          },
          uniqueIPs: { $size: '$uniqueIPs' },
        },
      },
    ]),
    this.aggregate([
      { $match: { ...botFilter(), ...tenantMatch(tenantId), visitedAt: { $gte: since24h } } },
      {
        $group: {
          _id: null,
          pageViews: { $sum: 1 },
          uniqueIPs: { $addToSet: '$ipAddress' },
        },
      },
      { $project: { pageViews: 1, uniqueIPs: { $size: '$uniqueIPs' } } },
    ]),
    this.aggregate([
      { $match: { ...botFilter(), ...tenantMatch(tenantId), visitedAt: { $gte: since7d } } },
      { $group: { _id: null, pageViews: { $sum: 1 } } },
    ]),
    this.aggregate([
      { $match: { ...botFilter(), ...tenantMatch(tenantId) } },
      { $group: { _id: '$ipAddress' } },
      { $count: 'visitors' },
    ]),
    this.aggregate([
      { $match: periodMatch },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$visitedAt' } },
          views: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', views: 1, _id: 0 } },
    ]),
    this.aggregate([
      { $match: periodMatch },
      {
        $group: {
          _id: '$path',
          viewCount: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$ipAddress' },
          lastViewed: { $max: '$visitedAt' },
        },
      },
      { $sort: { viewCount: -1 } },
      { $limit: 25 },
      {
        $project: {
          pagePath: { $ifNull: ['$_id', '/'] },
          viewCount: 1,
          uniqueVisitors: { $size: '$uniqueVisitors' },
          lastViewed: 1,
        },
      },
    ]),
    this.aggregate([
      { $match: periodMatch },
      {
        $group: {
          _id: '$country',
          views: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$ipAddress' },
        },
      },
      { $match: { _id: { $nin: [null, ''] } } },
      { $sort: { views: -1 } },
      { $limit: 25 },
      {
        $project: {
          countryCode: '$_id',
          views: 1,
          uniqueVisitors: { $size: '$uniqueVisitors' },
        },
      },
    ]),
    this.aggregate([
      { $match: { ...botFilter(), ...tenantMatch(tenantId) } },
      {
        $group: {
          _id: '$country',
          visitors: { $addToSet: '$ipAddress' },
        },
      },
      { $match: { _id: { $nin: [null, ''] } } },
      { $sort: { visitors: -1 } },
      { $limit: 25 },
      {
        $project: {
          countryCode: '$_id',
          visitors: { $size: '$visitors' },
        },
      },
    ]),
    this.aggregate([
      { $match: periodMatch },
      {
        $group: {
          _id: {
            $cond: [
              { $or: [{ $eq: ['$referrer', null] }, { $eq: ['$referrer', ''] }] },
              'Direct / none',
              '$referrer',
            ],
          },
          views: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$ipAddress' },
        },
      },
      { $sort: { views: -1 } },
      { $limit: 20 },
      {
        $project: {
          source: '$_id',
          views: 1,
          uniqueVisitors: { $size: '$uniqueVisitors' },
        },
      },
    ]),
  ]);

  const period = periodStats[0] || { pageViews: 0, uniqueVisitors: 0, uniqueIPs: 0 };
  const h24 = stats24h[0] || { pageViews: 0, uniqueIPs: 0 };
  const d7 = stats7d[0] || { pageViews: 0 };
  const totalVisitors = allTimeVisitors[0]?.visitors || 0;

  return {
    totals: {
      visitors: totalVisitors,
      visitors24h: h24.uniqueIPs || 0,
      pageViews: period.pageViews || 0,
      uniqueVisitors: period.uniqueVisitors || period.uniqueIPs || 0,
      pageViews24h: h24.pageViews || 0,
      pageViews7d: d7.pageViews || 0,
    },
    viewsByDay,
    topPages,
    countriesByActivity,
    countriesByVisitor,
    topReferrers,
  };
};

visitorSchema.statics.getLiveActivity = async function (minutes = 5, tenantId = null) {
  const since = new Date(Date.now() - Number(minutes || 5) * 60 * 1000);
  const recent = await this.find({
    ...botFilter(),
    ...tenantMatch(tenantId),
    visitedAt: { $gte: since },
  })
    .sort({ visitedAt: -1 })
    .limit(200)
    .lean();

  const byIp = new Map();
  for (const row of recent) {
    const key = row.ipAddress || row.sessionId || String(row._id);
    if (!byIp.has(key)) {
      byIp.set(key, {
        trackingKey: key,
        username: row.userId ? 'User' : 'Guest',
        countryCode: row.country,
        country: row.country,
        city: row.city,
        currentPage: row.path,
        lastSeenAt: row.visitedAt,
        pageViewsInSession: 0,
        deviceType: row.device,
      });
    }
    const entry = byIp.get(key);
    entry.pageViewsInSession += 1;
    if (row.visitedAt > entry.lastSeenAt) {
      entry.currentPage = row.path;
      entry.lastSeenAt = row.visitedAt;
    }
    const seconds = Math.round((Date.now() - new Date(entry.lastSeenAt).getTime()) / 1000);
    entry.timeOnPage = Math.max(0, seconds);
  }

  return Array.from(byIp.values()).sort(
    (a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt)
  );
};

visitorSchema.statics.listAggregatedVisitors = async function (options = {}) {
  const { limit = 500, skip = 0, country, device, tenantId } = options;
  const match = { ...botFilter(), ...tenantMatch(tenantId) };
  if (country) match.country = String(country).toUpperCase();
  if (device) match.device = device;

  const [rows, countResult] = await Promise.all([
    this.aggregate([
      { $match: match },
      { $sort: { visitedAt: -1 } },
      {
        $group: {
          _id: '$ipAddress',
          countryCode: { $first: '$country' },
          city: { $first: '$city' },
          region: { $first: '$region' },
          deviceType: { $first: '$device' },
          browser: { $first: '$browser' },
          os: { $first: '$os' },
          visitCount: { $sum: 1 },
          lastPath: { $first: '$path' },
          lastSeenAt: { $max: '$visitedAt' },
          referrer: { $first: '$referrer' },
        },
      },
      { $sort: { lastSeenAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          id: '$_id',
          trackingKey: '$_id',
          countryCode: 1,
          city: 1,
          region: 1,
          deviceType: 1,
          browser: 1,
          os: 1,
          visitCount: 1,
          lastPath: 1,
          lastSeenAt: 1,
          referrer: 1,
        },
      },
    ]),
    this.aggregate([
      { $match: match },
      { $group: { _id: '$ipAddress' } },
      { $count: 'total' },
    ]),
  ]);

  return {
    visitors: rows,
    total: countResult[0]?.total || 0,
  };
};

// Device breakdown for overview panel
visitorSchema.statics.getDeviceBreakdown = async function (days = 30, tenantId = null) {
  return this.aggregate([
    { $match: { ...botFilter(), ...dateRangeMatch(days), ...tenantMatch(tenantId) } },
    {
      $group: {
        _id: { $ifNull: ['$device', 'unknown'] },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $project: { device: '$_id', count: 1, _id: 0 } },
  ]);
};

// Static method to get article views by country
visitorSchema.statics.getArticleViewsByCountry = async function(articleId) {
  return await this.aggregate([
    {
      $match: {
        articleId: new mongoose.Types.ObjectId(articleId),
        isBot: false
      }
    },
    {
      $group: {
        _id: '$country',
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        country: '$_id',
        count: 1
      }
    },
    { $sort: { count: -1 } }
  ]);
};

const Visitor = mongoose.model('Visitor', visitorSchema);

module.exports = Visitor;



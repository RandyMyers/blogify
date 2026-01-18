const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema({
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
    matchStage.articleId = mongoose.Types.ObjectId(filters.articleId);
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

// Static method to get article views by country
visitorSchema.statics.getArticleViewsByCountry = async function(articleId) {
  return await this.aggregate([
    {
      $match: {
        articleId: mongoose.Types.ObjectId(articleId),
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



const mongoose = require('mongoose');

// Translation schema for ad content (multilingual)
const adTranslationSchema = new mongoose.Schema({
  title: { 
    type: String, 
    maxlength: 200,
    trim: true
  },
  description: { 
    type: String, 
    maxlength: 500,
    trim: true
  },
  ctaText: { 
    type: String, 
    maxlength: 50,
    trim: true
  },
  imageUrl: { 
    type: String,
    trim: true
  },
  htmlContent: { 
    type: String 
  }
}, { _id: false });

const adSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Ad name is required'],
    trim: true,
    maxlength: [200, 'Ad name cannot exceed 200 characters']
  },
  type: {
    type: String,
    required: [true, 'Ad type is required'],
    enum: {
      values: ['banner', 'native', 'sponsored_article', 'display'],
      message: 'Ad type must be one of: banner, native, sponsored_article, display'
    },
    index: true
  },
  status: {
    type: String,
    enum: {
      values: ['draft', 'active', 'paused', 'expired'],
      message: 'Status must be one of: draft, active, paused, expired'
    },
    default: 'draft',
    index: true
  },
  
  // Multilingual Content
  translations: {
    en: adTranslationSchema,
    fr: adTranslationSchema,
    es: adTranslationSchema,
    de: adTranslationSchema,
    it: adTranslationSchema,
    pt: adTranslationSchema,
    sv: adTranslationSchema,
    fi: adTranslationSchema,
    da: adTranslationSchema,
    no: adTranslationSchema,
    nl: adTranslationSchema
  },
  
  // Targeting
  targetRegions: [{
    type: String,
    uppercase: true,
    enum: {
      values: ['US', 'GB', 'CA', 'AU', 'FR', 'DE', 'ES', 'IT', 'PT', 'SE', 'NO', 'DK', 'FI', 'BE', 'NL', 'IE', 'LU', 'CH', 'AT'],
      message: 'Invalid region code'
    }
  }],
  targetCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  targetLanguages: [{
    type: String,
    enum: {
      values: ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'],
      message: 'Invalid language code'
    }
  }],
  
  // Scheduling
  startDate: {
    type: Date,
    index: true
  },
  endDate: {
    type: Date,
    index: true
  },
  priority: {
    type: Number,
    default: 0,
    min: [0, 'Priority cannot be negative'],
    max: [100, 'Priority cannot exceed 100'],
    index: true
  },
  
  // Placement
  placement: {
    type: String,
    required: [true, 'Placement is required'],
    enum: {
      values: ['header', 'sidebar', 'footer', 'inline', 'between_articles', 'article_sidebar'],
      message: 'Placement must be one of: header, sidebar, footer, inline, between_articles, article_sidebar'
    },
    index: true
  },
  position: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Links & Media
  clickUrl: {
    type: String,
    required: [true, 'Click URL is required'],
    trim: true
  },
  imageUrl: {
    type: String,
    trim: true
  },
  htmlContent: {
    type: String
  },
  
  // Analytics
  impressions: {
    type: Number,
    default: 0,
    min: 0
  },
  clicks: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Limits (Optional)
  maxImpressions: {
    type: Number,
    min: 0
  },
  maxClicks: {
    type: Number,
    min: 0
  },
  
  // Settings
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for performance
adSchema.index({ placement: 1, status: 1, isActive: 1 });
adSchema.index({ startDate: 1, endDate: 1 });
adSchema.index({ targetRegions: 1, targetLanguages: 1 });
adSchema.index({ priority: -1, position: 1 });

// Virtual for click-through rate
adSchema.virtual('ctr').get(function() {
  if (this.impressions === 0) return 0;
  return ((this.clicks / this.impressions) * 100).toFixed(2);
});

// Method to get translation for a language
adSchema.methods.getTranslation = function(language) {
  const lang = language.toLowerCase();
  if (this.translations && this.translations[lang]) {
    return this.translations[lang];
  }
  // Fallback to English
  return this.translations?.en || null;
};

// Method to check if ad is currently active (considering dates)
adSchema.methods.isCurrentlyActive = function() {
  if (!this.isActive || this.status !== 'active') {
    return false;
  }
  
  const now = new Date();
  
  // Check start date
  if (this.startDate && this.startDate > now) {
    return false;
  }
  
  // Check end date
  if (this.endDate && this.endDate < now) {
    return false;
  }
  
  // Check impression limit
  if (this.maxImpressions && this.impressions >= this.maxImpressions) {
    return false;
  }
  
  // Check click limit
  if (this.maxClicks && this.clicks >= this.maxClicks) {
    return false;
  }
  
  return true;
};

// Method to check if ad matches targeting
adSchema.methods.matchesTargeting = function(region, language, categoryId = null) {
  // Check region targeting
  if (this.targetRegions && this.targetRegions.length > 0) {
    if (!this.targetRegions.includes(region)) {
      return false;
    }
  }
  
  // Check language targeting
  if (this.targetLanguages && this.targetLanguages.length > 0) {
    if (!this.targetLanguages.includes(language)) {
      return false;
    }
  }
  
  // Check category targeting
  if (this.targetCategories && this.targetCategories.length > 0) {
    if (!categoryId || !this.targetCategories.some(cat => cat.toString() === categoryId.toString())) {
      return false;
    }
  }
  
  return true;
};

// Pre-save hook to update status based on dates
adSchema.pre('save', function(next) {
  if (this.status === 'active' || this.status === 'paused') {
    const now = new Date();
    
    // Auto-expire if end date passed
    if (this.endDate && this.endDate < now) {
      this.status = 'expired';
    }
  }
  
  next();
});

const Ad = mongoose.model('Ad', adSchema);

module.exports = Ad;





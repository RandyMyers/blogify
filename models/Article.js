const mongoose = require('mongoose');
const generateSlug = require('../utils/generateSlug');
const calculateReadTime = require('../utils/calculateReadTime');

// Translation schema for nested translations
const translationSchema = new mongoose.Schema({
  slug: { type: String, lowercase: true, index: true },
  title: { type: String, maxlength: 200 },
  excerpt: { type: String, maxlength: 500 },
  content: [String],
  metaTitle: { type: String, maxlength: 60 },
  metaDescription: { type: String, maxlength: 160 },
  keywords: [String]
}, { _id: false });

const articleSchema = new mongoose.Schema({
  // Base fields for multilingual support
  baseSlug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true
  },
  defaultLanguage: {
    type: String,
    required: true,
    default: 'en',
    enum: ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'],
    index: true
  },
  isGlobal: {
    type: Boolean,
    default: true,
    index: true
  },
  regionRestrictions: [{
    type: String,
    uppercase: true,
    enum: ['US', 'GB', 'CA', 'AU', 'FR', 'DE', 'ES', 'IT', 'PT', 'SE', 'NO', 'DK', 'FI', 'BE', 'NL', 'IE', 'LU', 'CH', 'AT']
  }],
  
  // Translations object - supports multiple languages
  translations: {
    en: translationSchema,
    fr: translationSchema,
    es: translationSchema,
    de: translationSchema,
    it: translationSchema,
    pt: translationSchema,
    sv: translationSchema,
    fi: translationSchema,
    da: translationSchema,
    no: translationSchema,
    nl: translationSchema
  },
  
  // Legacy fields (kept for backward compatibility during migration)
  title: {
    type: String,
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  slug: {
    type: String,
    lowercase: true,
    index: true
  },
  excerpt: {
    type: String,
    maxlength: [500, 'Excerpt cannot exceed 500 characters']
  },
  content: {
    type: [String] // Array of paragraphs
  },
  
  // Shared fields (not translated)
  imageUrl: {
    type: String,
    required: [true, 'Article image is required']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required'],
    index: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Author',
    required: [true, 'Author is required'],
    index: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  published: {
    type: Boolean,
    default: false,
    index: true
  },
  publishedAt: {
    type: Date,
    default: null,
    index: true
  },
  views: {
    type: Number,
    default: 0,
    min: 0
  },
  likes: {
    type: Number,
    default: 0,
    min: 0
  },
  readTime: {
    type: String,
    default: '1 min read'
  },
  featured: {
    type: Boolean,
    default: false,
    index: true
  },
  trending: {
    type: Boolean,
    default: false,
    index: true
  },
  // Legacy SEO field (kept for backward compatibility)
  seo: {
    metaTitle: { type: String, maxlength: 60 },
    metaDescription: { type: String, maxlength: 160 },
    keywords: [String]
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
// Legacy text search indexes (for backward compatibility)
articleSchema.index({ title: 'text', excerpt: 'text', 'content': 'text' });
// New multilingual text search indexes
articleSchema.index({ 'translations.en.title': 'text', 'translations.en.excerpt': 'text', 'translations.en.content': 'text' });
articleSchema.index({ 'translations.fr.title': 'text', 'translations.fr.excerpt': 'text', 'translations.fr.content': 'text' });
articleSchema.index({ 'translations.es.title': 'text', 'translations.es.excerpt': 'text', 'translations.es.content': 'text' });
articleSchema.index({ 'translations.de.title': 'text', 'translations.de.excerpt': 'text', 'translations.de.content': 'text' });
articleSchema.index({ 'translations.it.title': 'text', 'translations.it.excerpt': 'text', 'translations.it.content': 'text' });

// Base slug and language-specific slug indexes
articleSchema.index({ baseSlug: 1 });
articleSchema.index({ 'translations.en.slug': 1 });
articleSchema.index({ 'translations.fr.slug': 1 });
articleSchema.index({ 'translations.es.slug': 1 });
articleSchema.index({ 'translations.de.slug': 1 });
articleSchema.index({ 'translations.it.slug': 1 });
articleSchema.index({ 'translations.pt.slug': 1 });

// Legacy slug index (for backward compatibility)
articleSchema.index({ slug: 1 });

// Region and global access indexes
articleSchema.index({ isGlobal: 1, regionRestrictions: 1 });
articleSchema.index({ defaultLanguage: 1, published: 1 });

// Other indexes
articleSchema.index({ category: 1, published: 1 });
articleSchema.index({ author: 1, published: 1 });
articleSchema.index({ published: 1, publishedAt: -1 });
articleSchema.index({ featured: 1, published: 1 });
articleSchema.index({ trending: 1, published: 1 });
articleSchema.index({ views: -1 });
articleSchema.index({ createdAt: -1 });

// Pre-save hook to generate slug, calculate read time, and update timestamp
articleSchema.pre('save', function(next) {
  // Generate baseSlug from default language title if not provided
  if (!this.baseSlug) {
    const defaultTranslation = this.translations[this.defaultLanguage];
    if (defaultTranslation && defaultTranslation.title) {
      this.baseSlug = generateSlug(defaultTranslation.title);
    } else if (this.title) {
      // Fallback to legacy title field
      this.baseSlug = generateSlug(this.title);
    }
  }
  
  // Generate language-specific slugs from titles if not provided
  const supportedLanguages = ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'];
  supportedLanguages.forEach(lang => {
    if (this.translations[lang] && this.translations[lang].title && !this.translations[lang].slug) {
      this.translations[lang].slug = generateSlug(this.translations[lang].title);
    }
  });
  
  // Legacy slug handling (for backward compatibility)
  if (!this.slug) {
    const defaultTranslation = this.translations[this.defaultLanguage];
    if (defaultTranslation && defaultTranslation.slug) {
      this.slug = defaultTranslation.slug;
    } else if (this.title) {
      this.slug = generateSlug(this.title);
    }
  }
  
  // Calculate read time from content (use default language or legacy content)
  const defaultTranslation = this.translations[this.defaultLanguage];
  const contentToUse = (defaultTranslation && defaultTranslation.content) 
    ? defaultTranslation.content 
    : this.content;
  
  if (contentToUse && contentToUse.length > 0) {
    this.readTime = calculateReadTime(contentToUse);
  }
  
  // Set publishedAt when published is set to true
  if (this.published && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  // Update timestamp
  this.updatedAt = Date.now();
  next();
});

// Method to increment views
articleSchema.methods.incrementViews = async function() {
  this.views += 1;
  await this.save();
  
  // Update author's total views
  const Author = mongoose.model('Author');
  await Author.findByIdAndUpdate(this.author, { $inc: { totalViews: 1 } });
};

// Method to increment likes
articleSchema.methods.incrementLikes = async function() {
  this.likes += 1;
  await this.save();
};

// Static method to get featured articles
articleSchema.statics.getFeatured = function(limit = 1) {
  return this.find({ featured: true, published: true })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .populate('category', 'name slug color')
    .populate('author', 'name slug avatar');
};

// Static method to get top articles
articleSchema.statics.getTop = function(limit = 5) {
  return this.find({ published: true })
    .sort({ views: -1, publishedAt: -1 })
    .limit(limit)
    .populate('category', 'name slug color')
    .populate('author', 'name slug avatar');
};

// Static method to get popular articles
articleSchema.statics.getPopular = function(limit = 10) {
  // Popular = high views + recent (within last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return this.find({ 
    published: true,
    publishedAt: { $gte: thirtyDaysAgo }
  })
    .sort({ views: -1, likes: -1, publishedAt: -1 })
    .limit(limit)
    .populate('category', 'name slug color')
    .populate('author', 'name slug avatar');
};

// Static method to get trending articles
articleSchema.statics.getTrending = function(limit = 10) {
  return this.find({ trending: true, published: true })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .populate('category', 'name slug color')
    .populate('author', 'name slug avatar');
};

// Static method to search articles (with language support)
articleSchema.statics.search = function(query, options = {}) {
  const { limit = 10, skip = 0, category, author, language = 'en', region } = options;
  
  const searchQuery = {
    published: true
  };
  
  // Region filtering
  if (region) {
    searchQuery.$or = [
      { isGlobal: true },
      { regionRestrictions: region }
    ];
  } else {
    // If no region specified, only show global articles
    searchQuery.isGlobal = true;
  }
  
  // Language-specific text search
  if (language && this.schema.path(`translations.${language}.title`)) {
    searchQuery[`translations.${language}.title`] = { $exists: true };
    // Use language-specific text index if available
    searchQuery.$text = { $search: query };
  } else {
    // Fallback to legacy text search
    searchQuery.$text = { $search: query };
  }
  
  if (category) {
    searchQuery.category = category;
  }
  
  if (author) {
    searchQuery.author = author;
  }
  
  return this.find(searchQuery)
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .skip(skip)
    .populate('category', 'name slug color')
    .populate('author', 'name slug avatar');
};

// Method to get translation for a specific language
articleSchema.methods.getTranslation = function(language) {
  if (this.translations[language] && this.translations[language].title) {
    return this.translations[language];
  }
  // Fallback to default language
  return this.translations[this.defaultLanguage] || null;
};

// Method to get available languages
articleSchema.methods.getAvailableLanguages = function() {
  const available = [];
  const supportedLanguages = ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'];
  supportedLanguages.forEach(lang => {
    if (this.translations[lang] && this.translations[lang].title) {
      available.push(lang);
    }
  });
  return available;
};

const Article = mongoose.model('Article', articleSchema);

module.exports = Article;



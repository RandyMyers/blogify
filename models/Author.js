const mongoose = require('mongoose');
const generateSlug = require('../utils/generateSlug');

// Translation schema for author
const authorTranslationSchema = new mongoose.Schema({
  slug: { type: String, lowercase: true, index: true },
  bio: { type: String, maxlength: 500 }
}, { _id: false });

const authorSchema = new mongoose.Schema({
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
    default: 'en',
    enum: ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl']
  },
  
  // Translations object
  translations: {
    en: authorTranslationSchema,
    fr: authorTranslationSchema,
    es: authorTranslationSchema,
    de: authorTranslationSchema,
    it: authorTranslationSchema,
    pt: authorTranslationSchema,
    sv: authorTranslationSchema,
    fi: authorTranslationSchema,
    da: authorTranslationSchema,
    no: authorTranslationSchema,
    nl: authorTranslationSchema
  },
  
  // Name is usually same across languages (not translated)
  name: {
    type: String,
    required: [true, 'Author name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Author name cannot exceed 100 characters'],
    index: true
  },
  
  // Legacy fields (kept for backward compatibility)
  slug: {
    type: String,
    lowercase: true,
    index: true
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  
  avatar: {
    type: String,
    default: null
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
    match: [/\S+@\S+\.\S+/, 'Please use a valid email address']
  },
  socialLinks: {
    twitter: { type: String, default: null },
    linkedin: { type: String, default: null },
    github: { type: String, default: null },
    website: { type: String, default: null }
  },
  articleCount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalViews: {
    type: Number,
    default: 0,
    min: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
authorSchema.index({ baseSlug: 1 });
authorSchema.index({ 'translations.en.slug': 1 });
authorSchema.index({ 'translations.fr.slug': 1 });
authorSchema.index({ 'translations.es.slug': 1 });
authorSchema.index({ 'translations.de.slug': 1 });
authorSchema.index({ 'translations.it.slug': 1 });
// Legacy indexes (for backward compatibility)
authorSchema.index({ name: 1 });
authorSchema.index({ slug: 1 });
authorSchema.index({ email: 1 });

// Virtual for articles (will be populated)
authorSchema.virtual('articles', {
  ref: 'Article',
  localField: '_id',
  foreignField: 'author'
});

// Pre-save hook to generate slug and update timestamp
authorSchema.pre('save', function(next) {
  // Generate baseSlug from name if not provided
  if (!this.baseSlug && this.name) {
    this.baseSlug = generateSlug(this.name);
  }
  
  // Generate language-specific slugs from name if not provided
  const supportedLanguages = ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'];
  supportedLanguages.forEach(lang => {
    if (this.translations[lang] && !this.translations[lang].slug && this.name) {
      this.translations[lang].slug = generateSlug(this.name);
    }
  });
  
  // Legacy slug handling (for backward compatibility)
  if (!this.slug && this.name) {
    this.slug = generateSlug(this.name);
  }
  
  // Update timestamp
  this.updatedAt = Date.now();
  next();
});

// Method to update article count
authorSchema.methods.updateArticleCount = async function() {
  const Article = mongoose.model('Article');
  const count = await Article.countDocuments({ author: this._id, published: true });
  this.articleCount = count;
  await this.save();
};

// Method to update total views
authorSchema.methods.updateTotalViews = async function() {
  const Article = mongoose.model('Article');
  const result = await Article.aggregate([
    { $match: { author: this._id, published: true } },
    { $group: { _id: null, total: { $sum: '$views' } } }
  ]);
  this.totalViews = result.length > 0 ? result[0].total : 0;
  await this.save();
};

// Method to get translation for a specific language
authorSchema.methods.getTranslation = function(language) {
  if (this.translations[language] && this.translations[language].bio) {
    return this.translations[language];
  }
  // Fallback to default language
  return this.translations[this.defaultLanguage] || null;
};

const Author = mongoose.model('Author', authorSchema);

module.exports = Author;



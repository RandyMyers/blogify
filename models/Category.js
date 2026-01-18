const mongoose = require('mongoose');
const generateSlug = require('../utils/generateSlug');

// Translation schema for category
const categoryTranslationSchema = new mongoose.Schema({
  slug: { type: String, lowercase: true, index: true },
  name: { type: String, maxlength: 50 },
  description: { type: String, maxlength: 500 }
}, { _id: false });

const categorySchema = new mongoose.Schema({
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
    en: categoryTranslationSchema,
    fr: categoryTranslationSchema,
    es: categoryTranslationSchema,
    de: categoryTranslationSchema,
    it: categoryTranslationSchema,
    pt: categoryTranslationSchema,
    sv: categoryTranslationSchema,
    fi: categoryTranslationSchema,
    da: categoryTranslationSchema,
    no: categoryTranslationSchema,
    nl: categoryTranslationSchema
  },
  
  // Legacy fields (kept for backward compatibility)
  name: {
    type: String,
    trim: true,
    maxlength: [50, 'Category name cannot exceed 50 characters']
  },
  slug: {
    type: String,
    lowercase: true,
    index: true
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  // Shared fields (not translated)
  color: {
    type: String,
    required: true,
    enum: ['teal', 'coral', 'amber', 'violet', 'emerald', 'sky'],
    default: 'teal'
  },
  imageUrl: {
    type: String,
    default: null
  },
  isPopular: {
    type: Boolean,
    default: false,
    index: true
  },
  postCount: {
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
categorySchema.index({ baseSlug: 1 });
categorySchema.index({ 'translations.en.slug': 1 });
categorySchema.index({ 'translations.fr.slug': 1 });
categorySchema.index({ 'translations.es.slug': 1 });
categorySchema.index({ 'translations.de.slug': 1 });
categorySchema.index({ 'translations.it.slug': 1 });
// Legacy indexes (for backward compatibility)
categorySchema.index({ name: 1 });
categorySchema.index({ slug: 1 });
categorySchema.index({ isPopular: 1 });

// Virtual for articles (will be populated)
categorySchema.virtual('articles', {
  ref: 'Article',
  localField: '_id',
  foreignField: 'category'
});

// Pre-save hook to generate slug and update timestamp
categorySchema.pre('save', function(next) {
  // Generate baseSlug from default language name if not provided
  if (!this.baseSlug) {
    const defaultTranslation = this.translations[this.defaultLanguage];
    if (defaultTranslation && defaultTranslation.name) {
      this.baseSlug = generateSlug(defaultTranslation.name);
    } else if (this.name) {
      // Fallback to legacy name field
      this.baseSlug = generateSlug(this.name);
    }
  }
  
  // Generate language-specific slugs from names if not provided
  const supportedLanguages = ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'];
  supportedLanguages.forEach(lang => {
    if (this.translations[lang] && this.translations[lang].name && !this.translations[lang].slug) {
      this.translations[lang].slug = generateSlug(this.translations[lang].name);
    }
  });
  
  // Legacy slug handling (for backward compatibility)
  if (!this.slug) {
    const defaultTranslation = this.translations[this.defaultLanguage];
    if (defaultTranslation && defaultTranslation.slug) {
      this.slug = defaultTranslation.slug;
    } else if (this.name) {
      this.slug = generateSlug(this.name);
    }
  }
  
  // Update timestamp
  this.updatedAt = Date.now();
  next();
});

// Method to update post count
categorySchema.methods.updatePostCount = async function() {
  const Article = mongoose.model('Article');
  const count = await Article.countDocuments({ category: this._id, published: true });
  this.postCount = count;
  await this.save();
};

// Static method to get popular categories
categorySchema.statics.getPopular = function(limit = 4) {
  return this.find({ isPopular: true })
    .sort({ postCount: -1 })
    .limit(limit);
};

// Method to get translation for a specific language
categorySchema.methods.getTranslation = function(language) {
  if (this.translations[language] && this.translations[language].name) {
    return this.translations[language];
  }
  // Fallback to default language
  return this.translations[this.defaultLanguage] || null;
};

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;


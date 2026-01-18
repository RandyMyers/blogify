const mongoose = require('mongoose');

const regionSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    enum: ['US', 'GB', 'CA', 'AU', 'FR', 'DE', 'ES', 'IT', 'PT', 'SE', 'NO', 'DK', 'FI', 'BE', 'NL', 'IE', 'LU', 'CH', 'AT'],
    index: true
  },
  name: {
    type: String,
    required: true
  },
  languages: [{
    type: String,
    enum: ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl']
  }],
  defaultLanguage: {
    type: String,
    required: true,
    enum: ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl']
  },
  currency: {
    type: String,
    default: 'EUR'
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
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

// Pre-save hook to update timestamp
regionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to get active regions
regionSchema.statics.getActive = function() {
  return this.find({ isActive: true }).sort({ name: 1 });
};

// Static method to find by language
regionSchema.statics.findByLanguage = function(language) {
  return this.find({ 
    languages: language,
    isActive: true 
  });
};

const Region = mongoose.model('Region', regionSchema);

module.exports = Region;


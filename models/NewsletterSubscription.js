const mongoose = require('mongoose');
const crypto = require('crypto');

const newsletterSubscriptionSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/\S+@\S+\.\S+/, 'Please use a valid email address'],
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  confirmed: {
    type: Boolean,
    default: false,
    index: true
  },
  confirmedAt: {
    type: Date,
    default: null
  },
  unsubscribed: {
    type: Boolean,
    default: false,
    index: true
  },
  unsubscribedAt: {
    type: Date,
    default: null
  },
  subscribedAt: {
    type: Date,
    default: Date.now
  },
  lastEmailSent: {
    type: Date,
    default: null
  }
});

// Indexes
newsletterSubscriptionSchema.index({ email: 1 });
newsletterSubscriptionSchema.index({ token: 1 });
newsletterSubscriptionSchema.index({ confirmed: 1, unsubscribed: 1 });

// Pre-save hook to generate token if not provided
newsletterSubscriptionSchema.pre('save', function(next) {
  if (!this.token) {
    this.token = crypto.randomBytes(32).toString('hex');
  }
  next();
});

// Method to confirm subscription
newsletterSubscriptionSchema.methods.confirm = async function() {
  this.confirmed = true;
  this.confirmedAt = new Date();
  await this.save();
};

// Method to unsubscribe
newsletterSubscriptionSchema.methods.unsubscribe = async function() {
  this.unsubscribed = true;
  this.unsubscribedAt = new Date();
  await this.save();
};

// Static method to generate token
newsletterSubscriptionSchema.statics.generateToken = function() {
  return crypto.randomBytes(32).toString('hex');
};

// Static method to find by token
newsletterSubscriptionSchema.statics.findByToken = function(token) {
  return this.findOne({ token, unsubscribed: false });
};

// Static method to get active subscribers
newsletterSubscriptionSchema.statics.getActiveSubscribers = function() {
  return this.find({ confirmed: true, unsubscribed: false });
};

const NewsletterSubscription = mongoose.model('NewsletterSubscription', newsletterSubscriptionSchema);

module.exports = NewsletterSubscription;



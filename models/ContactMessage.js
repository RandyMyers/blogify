const mongoose = require('mongoose');

const contactMessageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/\S+@\S+\.\S+/, 'Please use a valid email address'],
    index: true
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    maxlength: [200, 'Subject cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    maxlength: [5000, 'Message cannot exceed 5000 characters']
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date,
    default: null
  },
  replied: {
    type: Boolean,
    default: false,
    index: true
  },
  repliedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Indexes
contactMessageSchema.index({ email: 1 });
contactMessageSchema.index({ read: 1, createdAt: -1 });
contactMessageSchema.index({ replied: 1, createdAt: -1 });
contactMessageSchema.index({ createdAt: -1 });

// Method to mark as read
contactMessageSchema.methods.markAsRead = async function() {
  this.read = true;
  this.readAt = new Date();
  await this.save();
};

// Method to mark as replied
contactMessageSchema.methods.markAsReplied = async function() {
  this.replied = true;
  this.repliedAt = new Date();
  await this.save();
};

// Static method to get unread messages
contactMessageSchema.statics.getUnread = function(limit = 10) {
  return this.find({ read: false })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get unreplied messages
contactMessageSchema.statics.getUnreplied = function(limit = 10) {
  return this.find({ replied: false })
    .sort({ createdAt: -1 })
    .limit(limit);
};

const ContactMessage = mongoose.model('ContactMessage', contactMessageSchema);

module.exports = ContactMessage;



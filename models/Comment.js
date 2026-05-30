const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true,
    },
    articleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Article',
      required: true,
      index: true,
    },
    articleSlug: {
      type: String,
      trim: true,
      index: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },
    authorName: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    authorEmail: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      maxlength: [120, 'Email cannot exceed 120 characters'],
    },
    authorWebsite: {
      type: String,
      trim: true,
      maxlength: [300, 'Website URL cannot exceed 300 characters'],
      default: '',
    },
    body: {
      type: String,
      required: [true, 'Comment body is required'],
      trim: true,
      maxlength: [2000, 'Comment cannot exceed 2000 characters'],
    },
    language: {
      type: String,
      default: 'en',
      enum: ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'],
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'spam', 'rejected'],
      default: 'pending',
      index: true,
    },
    ipHash: {
      type: String,
      index: true,
    },
    userAgent: {
      type: String,
      maxlength: 500,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

commentSchema.index({ tenantId: 1, articleId: 1, status: 1, createdAt: -1 });
commentSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
commentSchema.index({ articleId: 1, parentId: 1, createdAt: 1 });

module.exports = mongoose.model('Comment', commentSchema);

const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    domains: [
      {
        type: String,
        lowercase: true,
        trim: true
      }
    ],
    isDefault: {
      type: Boolean,
      default: false,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

tenantSchema.index({ slug: 1 }, { unique: true });
tenantSchema.index({ domains: 1 });
tenantSchema.index({ isDefault: 1, isActive: 1 });

module.exports = mongoose.model('Tenant', tenantSchema);

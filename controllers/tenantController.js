const Tenant = require('../models/Tenant');
const { asyncHandler } = require('../middleware/errorHandler');

exports.getTenants = asyncHandler(async (req, res) => {
  const tenants = await Tenant.find({}).sort({ createdAt: -1 });
  res.json({
    success: true,
    count: tenants.length,
    data: tenants
  });
});

exports.getTenantById = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findById(req.params.id);
  if (!tenant) {
    return res.status(404).json({
      success: false,
      message: 'Tenant not found'
    });
  }
  res.json({ success: true, data: tenant });
});

exports.createTenant = asyncHandler(async (req, res) => {
  const { name, slug, domains = [], isDefault = false, isActive = true } = req.body;

  if (!name || !slug) {
    return res.status(400).json({
      success: false,
      message: 'name and slug are required'
    });
  }

  const existing = await Tenant.findOne({ slug: slug.toLowerCase().trim() });
  if (existing) {
    return res.status(400).json({
      success: false,
      message: 'Tenant slug already exists'
    });
  }

  if (isDefault) {
    await Tenant.updateMany({ isDefault: true }, { $set: { isDefault: false } });
  }

  const tenant = await Tenant.create({
    name: name.trim(),
    slug: slug.toLowerCase().trim(),
    domains: Array.isArray(domains) ? domains.map((d) => d.toLowerCase().trim()).filter(Boolean) : [],
    isDefault: Boolean(isDefault),
    isActive: Boolean(isActive)
  });

  res.status(201).json({ success: true, data: tenant });
});

exports.updateTenant = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findById(req.params.id);
  if (!tenant) {
    return res.status(404).json({
      success: false,
      message: 'Tenant not found'
    });
  }

  const { name, slug, domains, isDefault, isActive } = req.body;

  if (slug && slug.toLowerCase().trim() !== tenant.slug) {
    const exists = await Tenant.findOne({ slug: slug.toLowerCase().trim(), _id: { $ne: tenant._id } });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Tenant slug already exists'
      });
    }
  }

  if (typeof isDefault === 'boolean' && isDefault) {
    await Tenant.updateMany({ isDefault: true, _id: { $ne: tenant._id } }, { $set: { isDefault: false } });
  }

  if (name !== undefined) tenant.name = name.trim();
  if (slug !== undefined) tenant.slug = slug.toLowerCase().trim();
  if (domains !== undefined) {
    tenant.domains = Array.isArray(domains) ? domains.map((d) => d.toLowerCase().trim()).filter(Boolean) : [];
  }
  if (typeof isDefault === 'boolean') tenant.isDefault = isDefault;
  if (typeof isActive === 'boolean') tenant.isActive = isActive;

  await tenant.save();
  res.json({ success: true, data: tenant });
});

exports.deleteTenant = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findById(req.params.id);
  if (!tenant) {
    return res.status(404).json({
      success: false,
      message: 'Tenant not found'
    });
  }

  if (tenant.isDefault) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete default tenant'
    });
  }

  await tenant.deleteOne();
  res.json({ success: true, message: 'Tenant deleted' });
});

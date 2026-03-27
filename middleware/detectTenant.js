const Tenant = require('../models/Tenant');

const normalizeHost = (value = '') => {
  return value
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0];
};

const resolveTenant = async (req) => {
  const tenantSlugHeader = req.headers['x-tenant-slug'];
  const tenantIdHeader = req.headers['x-tenant-id'];
  const tenantQuery = req.query.tenant;

  if (tenantIdHeader) {
    const byId = await Tenant.findOne({ _id: tenantIdHeader, isActive: true });
    if (byId) return byId;
  }

  const candidateSlug = (tenantSlugHeader || tenantQuery || '').toString().toLowerCase().trim();
  if (candidateSlug) {
    const bySlug = await Tenant.findOne({ slug: candidateSlug, isActive: true });
    if (bySlug) return bySlug;
  }

  const originHost = normalizeHost(req.headers.origin || '');
  const forwardedHost = normalizeHost(req.headers['x-forwarded-host'] || '');
  const hostHeader = normalizeHost(req.headers.host || '');

  const hosts = [originHost, forwardedHost, hostHeader].filter(Boolean);
  if (hosts.length > 0) {
    const byDomain = await Tenant.findOne({
      isActive: true,
      domains: { $in: hosts }
    });
    if (byDomain) return byDomain;
  }

  return Tenant.findOne({ isDefault: true, isActive: true }) || Tenant.findOne({ isActive: true });
};

const detectTenant = async (req, res, next) => {
  try {
    const tenant = await resolveTenant(req);

    if (!tenant) {
      req.tenant = null;
      req.tenantId = null;
      req.tenantSlug = null;
      return next();
    }

    req.tenant = tenant;
    req.tenantId = tenant._id;
    req.tenantSlug = tenant.slug;
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { detectTenant };

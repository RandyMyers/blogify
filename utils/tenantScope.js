/**
 * Helpers for tenant-scoped database queries.
 */

class TenantScopeError extends Error {
  constructor(message = 'Tenant not resolved for this site') {
    super(message);
    this.name = 'TenantScopeError';
    this.statusCode = 400;
  }
}

function scopedFilter(req, { required = true } = {}) {
  if (!req?.tenantId) {
    if (required) throw new TenantScopeError();
    return {};
  }
  return { tenantId: req.tenantId };
}

function scopedIdFilter(req, id, { required = true } = {}) {
  return { _id: id, ...scopedFilter(req, { required }) };
}

module.exports = {
  TenantScopeError,
  scopedFilter,
  scopedIdFilter,
};

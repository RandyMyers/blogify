const TENANT_SLUG_ALIASES = {
  default: 'bloomwik',
};

function normalizeTenantSlug(slug) {
  const raw = String(slug || '').trim().toLowerCase();
  if (!raw) return 'bloomwik';
  return TENANT_SLUG_ALIASES[raw] || raw;
}

async function resolveTenantId(Tenant, slug) {
  const normalized = normalizeTenantSlug(slug);
  let tenant = await Tenant.findOne({ slug: normalized, isActive: true });
  if (!tenant && normalized !== slug) {
    tenant = await Tenant.findOne({ slug, isActive: true });
  }
  if (!tenant) {
    tenant =
      (await Tenant.findOne({ isDefault: true, isActive: true })) ||
      (await Tenant.findOne({ isActive: true }));
  }
  return tenant;
}

module.exports = {
  normalizeTenantSlug,
  resolveTenantId,
};

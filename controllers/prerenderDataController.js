const { asyncHandler } = require('../middleware/errorHandler');
const { buildPrerenderPages } = require('../utils/prerenderPages');
const { injectPrerenderIntoTemplate } = require('../utils/prerenderMeta');
const Tenant = require('../models/Tenant');
const { normalizeTenantSlug } = require('../utils/tenantResolve');

async function resolveRequestTenantId(req) {
  if (req.tenantId) return req.tenantId;

  const slug = normalizeTenantSlug(
    req.headers['x-tenant-slug'] || req.query.tenant || req.tenantSlug
  );
  const tenant = await Tenant.findOne({ slug, isActive: true });
  return tenant?._id || null;
}

/**
 * @route GET /api/prerender-data/pages
 * Returns all prerender page descriptors for build-time static HTML generation.
 */
exports.getPrerenderPages = asyncHandler(async (req, res) => {
  const tenantId = await resolveRequestTenantId(req);
  if (!tenantId) {
    return res.status(400).json({
      success: false,
      message: 'Tenant not resolved. Set x-tenant-slug to bloomwik (or your site slug).',
    });
  }

  const data = await buildPrerenderPages(tenantId);
  res.json({
    success: true,
    tenant: normalizeTenantSlug(req.headers['x-tenant-slug'] || req.query.tenant || 'bloomwik'),
    data,
  });
});

/**
 * @route POST /api/prerender-data/render
 * Body: { templateHtml, path } — returns fully injected HTML for one page (runtime SSR).
 */
exports.renderPrerenderPage = asyncHandler(async (req, res) => {
  const { templateHtml, path: pagePath } = req.body || {};
  if (!templateHtml || !pagePath) {
    return res.status(400).json({
      success: false,
      message: 'templateHtml and path are required',
    });
  }

  const tenantId = await resolveRequestTenantId(req);
  if (!tenantId) {
    return res.status(400).json({
      success: false,
      message: 'Tenant not resolved',
    });
  }

  const data = await buildPrerenderPages(tenantId);
  const page = data.pages.find((p) => p.path === pagePath);
  if (!page) {
    return res.status(404).json({
      success: false,
      message: 'Page not found in prerender catalog',
    });
  }

  const html = injectPrerenderIntoTemplate(templateHtml, page, data.siteSettings);
  res.json({
    success: true,
    data: { html, path: pagePath },
  });
});

module.exports.buildPrerenderPages = buildPrerenderPages;

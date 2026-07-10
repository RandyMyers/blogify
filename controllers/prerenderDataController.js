const { asyncHandler } = require('../middleware/errorHandler');
const { buildPrerenderPages } = require('../utils/prerenderPages');
const { injectPrerenderIntoTemplate } = require('../utils/prerenderMeta');

/**
 * @route GET /api/prerender-data/pages
 * Returns all prerender page descriptors for build-time static HTML generation.
 */
exports.getPrerenderPages = asyncHandler(async (req, res) => {
  const data = await buildPrerenderPages(req.tenantId);
  res.json({
    success: true,
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

  const data = await buildPrerenderPages(req.tenantId);
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

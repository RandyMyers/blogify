const { asyncHandler } = require('./errorHandler');
const { validatePublishSeo } = require('../utils/articleSeoHelpers');

/**
 * Block publish when tenant SEO rules fail (only when published: true in body).
 */
exports.validateArticlePublishSeo = asyncHandler(async (req, res, next) => {
  if (req.body.published !== true) {
    return next();
  }

  const { errors, analysis } = await validatePublishSeo(req.body, req.tenantId);

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: errors[0],
      errors,
      seo: {
        score: analysis.score,
        grade: analysis.grade,
        checks: analysis.checks.filter((c) => c.status === 'bad').slice(0, 5),
      },
    });
  }

  req.seoAnalysis = analysis;
  return next();
});

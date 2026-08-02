/**
 * Audit article keywords across the DB.
 * Usage: node scripts/auditArticleKeywords.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Article = require('../models/Article');

const LANGS = ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'];

async function main() {
  await mongoose.connect(process.env.MONGO_URL);

  const articles = await Article.find({})
    .select('baseSlug published seo.keywords translations')
    .lean();

  const withKeywords = [];
  const emptyKeywords = [];
  const focusOnly = [];

  for (const a of articles) {
    const locales = {};
    let anyKw = false;
    let anyFocus = false;

    for (const lang of LANGS) {
      const tr = a.translations?.[lang];
      if (!tr?.title) continue;
      const kw = Array.isArray(tr.keywords) ? tr.keywords.filter(Boolean) : [];
      const focus = String(tr.focusKeyword || '').trim();
      locales[lang] = { keywords: kw, focusKeyword: focus, metaTitle: tr.metaTitle || '' };
      if (kw.length) anyKw = true;
      if (focus) anyFocus = true;
    }

    const legacy = Array.isArray(a.seo?.keywords) ? a.seo.keywords.filter(Boolean) : [];
    if (legacy.length) anyKw = true;

    const row = {
      baseSlug: a.baseSlug,
      published: a.published,
      legacyKeywords: legacy,
      locales,
    };

    if (anyKw) withKeywords.push(row);
    else if (anyFocus) focusOnly.push(row);
    else emptyKeywords.push(row);
  }

  console.log(
    JSON.stringify(
      {
        total: articles.length,
        withKeywords: withKeywords.length,
        focusKeywordOnly: focusOnly.length,
        emptyKeywords: emptyKeywords.length,
        examplesWithKeywords: withKeywords.slice(0, 15).map((r) => ({
          slug: r.baseSlug,
          published: r.published,
          legacy: r.legacyKeywords,
          locales: Object.fromEntries(
            Object.entries(r.locales).map(([lang, v]) => [
              lang,
              { keywords: v.keywords, focus: v.focusKeyword },
            ])
          ),
        })),
        examplesFocusOnly: focusOnly.slice(0, 10).map((r) => ({
          slug: r.baseSlug,
          focus: Object.fromEntries(
            Object.entries(r.locales)
              .filter(([, v]) => v.focusKeyword)
              .map(([lang, v]) => [lang, v.focusKeyword])
          ),
        })),
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});

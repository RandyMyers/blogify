/**
 * Inspect an article's stored SEO (keywords / metaTitle / metaDescription)
 * vs what the public API would expose — no keyword fallbacks.
 *
 * Usage:
 *   node scripts/checkArticleSeo.js chained-soldier-chapter-1-birth-of-a-slave
 *   node scripts/checkArticleSeo.js chained-soldier-chapter-1-birth-of-a-slave --lang=en
 *   node scripts/checkArticleSeo.js chained-soldier-chapter-1-birth-of-a-slave --fix
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Article = require('../models/Article');
const { buildTranslationSeo, normalizeKeywordList } = require('../utils/translationSeo');

const SUPPORTED = ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'];

function parseArgs(argv) {
  const slug = argv.find((a) => !a.startsWith('-')) || 'chained-soldier-chapter-1-birth-of-a-slave';
  const langArg = argv.find((a) => a.startsWith('--lang='));
  const lang = (langArg ? langArg.slice('--lang='.length) : 'en').toLowerCase();
  const fix = argv.includes('--fix');
  return { slug, lang, fix };
}

function plain(tr) {
  if (!tr) return null;
  if (typeof tr.toObject === 'function') return tr.toObject({ depopulate: true });
  return tr;
}

function seoSnapshot(tr) {
  const p = plain(tr) || {};
  return {
    title: p.title || '',
    metaTitle: p.metaTitle || '',
    metaDescription: p.metaDescription || '',
    keywords: normalizeKeywordList(p.keywords),
    focusKeyword: p.focusKeyword || '',
  };
}

async function findArticle(slug) {
  return Article.findOne({
    $or: [
      { baseSlug: slug },
      { slug },
      { previousSlugs: slug },
      ...SUPPORTED.map((lang) => ({ [`translations.${lang}.slug`]: slug })),
    ],
  });
}

async function main() {
  const { slug, lang, fix } = parseArgs(process.argv.slice(2));
  const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI;
  if (!mongoUrl) {
    console.error('MONGO_URL is not set');
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);
  const article = await findArticle(slug);

  if (!article) {
    console.error(`Article not found for slug: ${slug}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const active =
    (article.translations?.[lang]?.title && article.translations[lang]) ||
    article.getTranslation(lang) ||
    article.getTranslation(article.defaultLanguage);

  const built = buildTranslationSeo(active, {
    siteUrl: process.env.CLIENT_URL || 'https://bloomwik.com',
    regionCode: 'US',
    slug: active?.slug || article.baseSlug || slug,
  });

  const legacySeo = plain(article.seo) || article.seo || {};
  const report = {
    _id: String(article._id),
    baseSlug: article.baseSlug,
    defaultLanguage: article.defaultLanguage,
    requestedLang: lang,
    articleTags: article.tags || [],
    legacySeo: {
      metaTitle: legacySeo.metaTitle || '',
      metaDescription: legacySeo.metaDescription || '',
      keywords: normalizeKeywordList(legacySeo.keywords),
    },
    perLocale: {},
    publicApiWouldReturn: {
      metaTitle: built.metaTitle,
      metaDescription: built.metaDescription,
      keywords: built.keywords,
      focusKeyword: built.focusKeyword,
    },
    mismatchHints: [],
  };

  SUPPORTED.forEach((code) => {
    const tr = article.translations?.[code];
    if (!tr?.title) return;
    report.perLocale[code] = seoSnapshot(tr);
  });

  const localeKw = report.perLocale[lang]?.keywords || [];
  const legacyKw = report.legacySeo.keywords;
  const tags = report.articleTags;

  if (
    localeKw.length &&
    legacyKw.length &&
    JSON.stringify(localeKw.map((k) => k.toLowerCase())) !==
      JSON.stringify(legacyKw.map((k) => k.toLowerCase()))
  ) {
    report.mismatchHints.push(
      `Locale (${lang}) keywords differ from legacy article.seo.keywords — public API must use locale only (no legacy fallback).`
    );
  }

  if (
    !localeKw.length &&
    (legacyKw.length || tags.length)
  ) {
    report.mismatchHints.push(
      `Locale (${lang}) has empty keywords but legacy seo/tags have values — old fallback would have shown incorrect keywords.`
    );
  }

  if (
    built.keywords.length &&
    tags.length &&
    built.keywords.some((k) => tags.map((t) => String(t).toLowerCase()).includes(k.toLowerCase())) &&
    localeKw.length === 0
  ) {
    report.mismatchHints.push(
      'Public keywords appear to come from article.tags rather than admin locale keywords.'
    );
  }

  if (!built.metaTitle) {
    report.mismatchHints.push(`Locale (${lang}) metaTitle is empty.`);
  }
  if (!built.metaDescription) {
    report.mismatchHints.push(`Locale (${lang}) metaDescription is empty.`);
  }

  if (!localeKw.length && report.perLocale[lang]?.focusKeyword) {
    report.mismatchHints.push(
      `Locale (${lang}) keywords[] is empty, but focusKeyword is set ("${report.perLocale[lang].focusKeyword}"). ` +
        'Older clients may have shown focusKeyword as meta keywords. Re-save Keywords in admin if you expect a keyword list.'
    );
  }

  if (!localeKw.length && !legacyKw.length) {
    report.mismatchHints.push(
      `No keywords stored for locale (${lang}) or legacy seo. Public meta keywords will be empty (no fallbacks).`
    );
  }

  console.log(JSON.stringify(report, null, 2));

  if (fix) {
    // Align legacy article.seo with default-locale SEO so admin/legacy stay consistent.
    // Does NOT invent keywords — copies default locale only.
    const def = article.defaultLanguage || 'en';
    const defTr = plain(article.translations?.[def]) || {};
    article.seo = {
      ...(typeof article.seo?.toObject === 'function' ? article.seo.toObject() : article.seo || {}),
      metaTitle: defTr.metaTitle || '',
      metaDescription: defTr.metaDescription || '',
      keywords: normalizeKeywordList(defTr.keywords),
    };
    article.markModified('seo');
    await article.save();
    console.log('\n--fix: synced article.seo from default-locale translation fields.');
  }

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

/**
 * Force index,follow on all published article translations + regional overrides.
 *
 * Usage (from server/):
 *   node scripts/forcePublishedArticlesIndexable.js
 *   node scripts/forcePublishedArticlesIndexable.js --dry-run
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Article = require('../models/Article');

const DRY_RUN = process.argv.includes('--dry-run');
const LANGS = ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'];

function needsIndexFix(robots) {
  return !robots || String(robots).toLowerCase().includes('noindex');
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('Missing MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const articles = await Article.find({ published: true });
  let updated = 0;
  let touchedLocales = 0;

  for (const article of articles) {
    let dirty = false;

    LANGS.forEach((lang) => {
      const tr = article.translations?.[lang];
      if (!tr?.title) return;
      if (needsIndexFix(tr.robots)) {
        tr.robots = 'index,follow';
        dirty = true;
        touchedLocales += 1;
      }
    });

    if (article.regionalTranslations) {
      const entries =
        article.regionalTranslations instanceof Map
          ? [...article.regionalTranslations.entries()]
          : Object.entries(article.regionalTranslations);
      entries.forEach(([code, block]) => {
        if (!block?.title) return;
        if (needsIndexFix(block.robots)) {
          block.robots = 'index,follow';
          if (article.regionalTranslations instanceof Map) {
            article.regionalTranslations.set(code, block);
          }
          dirty = true;
          touchedLocales += 1;
        }
      });
      if (dirty) article.markModified('regionalTranslations');
    }

    if (dirty) {
      article.markModified('translations');
      updated += 1;
      console.log(`${DRY_RUN ? '[dry-run] ' : ''}fix ${article.baseSlug || article._id}`);
      if (!DRY_RUN) await article.save();
    }
  }

  console.log(
    `Done. ${updated} published articles ${DRY_RUN ? 'would be' : 'were'} updated (${touchedLocales} locale blocks).`
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

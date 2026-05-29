/**
 * Validate category translation integrity — slug collisions, legacy mismatches, missing default lang.
 *
 * Usage: node scripts/checkCategoryTranslations.js
 *        npm run check:categories
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Category = require('../models/Category');

dotenv.config();

const SUPPORTED_LANGUAGES = ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'];

const issues = [];
let exitCode = 0;

function add(severity, code, category, message, extra = {}) {
  issues.push({
    severity,
    code,
    categoryId: category._id?.toString(),
    baseSlug: category.baseSlug,
    defaultLanguage: category.defaultLanguage,
    message,
    ...extra,
  });
  if (severity === 'error') exitCode = 1;
}

function legacySnapshot(category) {
  return {
    legacyName: category.name || null,
    legacySlug: category.slug || null,
    legacyDescription: category.description || null,
  };
}

function checkCategory(category) {
  const label = category.baseSlug || category._id?.toString();
  const defaultLang = category.defaultLanguage || 'en';

  if (!category.baseSlug) {
    add('error', 'MISSING_BASE_SLUG', category, 'Category has no baseSlug');
  }

  const defaultTr = category.translations?.[defaultLang];
  if (!defaultTr?.name?.trim()) {
    add('error', 'MISSING_DEFAULT_TRANSLATION', category, `Missing name in default language (${defaultLang})`);
  }

  if (category.name && defaultTr?.name && category.name.trim() !== defaultTr.name.trim()) {
    add('warn', 'LEGACY_NAME_MISMATCH', category, `Legacy name "${category.name}" differs from ${defaultLang} translation "${defaultTr.name}"`, legacySnapshot(category));
  }

  if (category.slug && defaultTr?.slug && category.slug !== defaultTr.slug) {
    add('warn', 'LEGACY_SLUG_MISMATCH', category, `Legacy slug "${category.slug}" differs from ${defaultLang} slug "${defaultTr.slug}"`);
  }

  SUPPORTED_LANGUAGES.forEach((lang) => {
    const tr = category.translations?.[lang];
    if (!tr) return;

    const hasName = Boolean(tr.name?.trim());
    const hasSlug = Boolean(tr.slug?.trim());

    if (hasName && !hasSlug) {
      add('error', 'NAME_WITHOUT_SLUG', category, `[${lang}] Has name but no slug`, { lang, name: tr.name });
    }
    if (hasSlug && !hasName) {
      add('error', 'SLUG_WITHOUT_NAME', category, `[${lang}] Has slug "${tr.slug}" but no name`, { lang });
    }
    if (hasName && hasSlug && tr.slug !== tr.slug.toLowerCase()) {
      add('warn', 'SLUG_NOT_LOWERCASE', category, `[${lang}] Slug should be lowercase: "${tr.slug}"`, { lang });
    }
  });
}

function checkCollisions(categories) {
  /** @type {Map<string, { id: string, baseSlug: string, name: string }>} */
  const slugOwners = new Map();

  categories.forEach((category) => {
    SUPPORTED_LANGUAGES.forEach((lang) => {
      const tr = category.translations?.[lang];
      if (!tr?.slug?.trim()) return;

      const key = `${lang}:${tr.slug.trim().toLowerCase()}`;
      const name = tr.name || category.baseSlug;
      const entry = { id: category._id.toString(), baseSlug: category.baseSlug, name };

      if (slugOwners.has(key)) {
        const other = slugOwners.get(key);
        add('error', 'DUPLICATE_SLUG', category, `[${lang}] Slug "${tr.slug}" collides with category "${other.baseSlug}" (${other.name})`, {
          lang,
          slug: tr.slug,
          otherCategoryId: other.id,
          otherBaseSlug: other.baseSlug,
        });
      } else {
        slugOwners.set(key, entry);
      }
    });

    if (category.baseSlug) {
      const baseKey = `base:${category.baseSlug.toLowerCase()}`;
      if (slugOwners.has(baseKey)) {
        const other = slugOwners.get(baseKey);
        add('error', 'DUPLICATE_BASE_SLUG', category, `baseSlug "${category.baseSlug}" duplicated with "${other.baseSlug}"`, {
          otherCategoryId: other.id,
        });
      } else {
        slugOwners.set(baseKey, { id: category._id.toString(), baseSlug: category.baseSlug, name: category.baseSlug });
      }
    }
  });
}

function printReport(categories) {
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warn');

  console.log('\n' + '='.repeat(72));
  console.log('CATEGORY TRANSLATION CHECK');
  console.log('='.repeat(72));
  console.log(`Categories scanned: ${categories.length}`);
  console.log(`Errors:   ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log('='.repeat(72));

  if (!issues.length) {
    console.log('\n✅ All categories look consistent — no translation confusion detected.\n');
    return;
  }

  const byCode = {};
  issues.forEach((i) => {
    if (!byCode[i.code]) byCode[i.code] = [];
    byCode[i.code].push(i);
  });

  Object.entries(byCode).forEach(([code, rows]) => {
    console.log(`\n${rows[0].severity.toUpperCase()} — ${code} (${rows.length})`);
    console.log('-'.repeat(72));
    rows.forEach((row) => {
      const prefix = row.baseSlug ? `[${row.baseSlug}]` : `[${row.categoryId}]`;
      const lang = row.lang ? ` (${row.lang})` : '';
      console.log(`  ${prefix}${lang}: ${row.message}`);
    });
  });

  console.log('\n' + '='.repeat(72));
  if (errors.length) {
    console.log('❌ Fix errors before publishing — slug collisions break localized category URLs.');
  } else {
    console.log('⚠️  Warnings only — review legacy field mismatches when convenient.');
  }
  console.log('='.repeat(72) + '\n');
}

async function main() {
  const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI;
  if (!mongoUrl) {
    console.error('MONGO_URL or MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);
  console.log('Connected to MongoDB');

  const categories = await Category.find({}).lean();
  categories.forEach(checkCategory);
  checkCollisions(categories);
  printReport(categories);

  await mongoose.disconnect();
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

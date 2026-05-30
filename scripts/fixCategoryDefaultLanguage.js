/**
 * Check (and optionally fix) category defaultLanguage + English legacy fields.
 *
 * Admin should always show English names. Categories with defaultLanguage !== 'en'
 * or legacy name/slug out of sync with translations.en cause confusion.
 *
 * Usage:
 *   npm run check:category-lang          # report only
 *   npm run fix:category-lang            # apply fixes (--fix)
 *   node scripts/fixCategoryDefaultLanguage.js --fix --tenant=bloomwik
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Category = require('../models/Category');
const Tenant = require('../models/Tenant');

const ENGLISH_NAMES_BY_BASE_SLUG = {
  business: 'Business',
  design: 'Design',
  fashion: 'Fashion',
  lifestyle: 'Lifestyle',
  technology: 'Technology',
  travel: 'Travel',
  wellness: 'Wellness',
};

function parseArgs() {
  const fix = process.argv.includes('--fix');
  const tenantArg = process.argv.find((a) => a.startsWith('--tenant='));
  return {
    fix,
    tenantSlug: tenantArg ? tenantArg.split('=')[1].trim().toLowerCase() : null,
  };
}

function englishName(category) {
  return category.translations?.en?.name?.trim() || null;
}

function englishSlug(category) {
  return category.translations?.en?.slug?.trim() || category.baseSlug || null;
}

function adminWouldShow(category) {
  const lang = category.defaultLanguage || 'en';
  return category.translations?.[lang]?.name || category.name || category.baseSlug;
}

function analyzeCategory(category) {
  const enName = englishName(category);
  const expectedEn = ENGLISH_NAMES_BY_BASE_SLUG[category.baseSlug];
  const issues = [];

  if ((category.defaultLanguage || 'en') !== 'en') {
    issues.push(`defaultLanguage is "${category.defaultLanguage}" (should be "en")`);
  }

  if (!enName) {
    issues.push('missing translations.en.name');
  } else if (expectedEn && enName !== expectedEn) {
    issues.push(`English name is "${enName}" (expected "${expectedEn}")`);
  }

  if (category.name && enName && category.name.trim() !== enName) {
    issues.push(`legacy name "${category.name}" differs from English "${enName}"`);
  }

  if (category.slug && englishSlug(category) && category.slug !== englishSlug(category)) {
    issues.push(`legacy slug "${category.slug}" differs from English "${englishSlug(category)}"`);
  }

  const displayed = adminWouldShow(category);
  if (enName && displayed !== enName) {
    issues.push(`admin list would show "${displayed}" instead of English "${enName}"`);
  }

  return { enName, issues };
}

async function resolveTenantFilter(tenantSlug) {
  if (!tenantSlug) return {};
  const tenant = await Tenant.findOne({ slug: tenantSlug }).lean();
  if (!tenant) {
    console.error(`Tenant not found: ${tenantSlug}`);
    process.exit(1);
  }
  return { tenantId: tenant._id };
}

async function applyFix(category) {
  const en = category.translations?.en || {};
  let changed = false;

  if (category.defaultLanguage !== 'en') {
    category.defaultLanguage = 'en';
    changed = true;
  }

  const enName = en.name?.trim() || ENGLISH_NAMES_BY_BASE_SLUG[category.baseSlug];
  if (enName && !en.name?.trim()) {
    category.translations.en = { ...en, name: enName, slug: en.slug || category.baseSlug };
    category.markModified('translations');
    changed = true;
  }

  const resolvedEnName = category.translations?.en?.name?.trim();
  const resolvedEnSlug = category.translations?.en?.slug?.trim() || category.baseSlug;

  if (resolvedEnName && category.name !== resolvedEnName) {
    category.name = resolvedEnName;
    changed = true;
  }
  if (resolvedEnSlug && category.slug !== resolvedEnSlug) {
    category.slug = resolvedEnSlug;
    changed = true;
  }
  if (en.description !== undefined && category.description !== en.description) {
    category.description = en.description || '';
    changed = true;
  }

  if (changed) {
    await category.save();
  }
  return changed;
}

async function main() {
  const { fix, tenantSlug } = parseArgs();
  const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI;
  if (!mongoUrl) {
    console.error('MONGO_URL or MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);
  console.log(`Connected to MongoDB${fix ? ' (FIX mode)' : ' (check only)'}\n`);

  const tenantFilter = await resolveTenantFilter(tenantSlug);
  const categories = await Category.find(tenantFilter).sort({ baseSlug: 1 });

  let issueCount = 0;
  let fixedCount = 0;

  console.log('='.repeat(72));
  console.log('CATEGORY ENGLISH / defaultLanguage CHECK');
  console.log('='.repeat(72));
  console.log(`Categories: ${categories.length}${tenantSlug ? ` (tenant: ${tenantSlug})` : ''}\n`);

  for (const doc of categories) {
    const category = fix ? doc : doc.toObject();
    const { enName, issues } = analyzeCategory(category);

    const status = issues.length ? 'ISSUE' : 'OK';
    console.log(`[${status}] ${category.baseSlug || category._id}`);
    console.log(`       defaultLanguage: ${category.defaultLanguage || 'en'}`);
    console.log(`       English name:    ${enName || '(missing)'}`);
    console.log(`       Legacy name:     ${category.name || '(empty)'}`);
    console.log(`       Admin display:   ${adminWouldShow(category)}`);

    if (issues.length) {
      issueCount += 1;
      issues.forEach((msg) => console.log(`       ⚠ ${msg}`));

      if (fix) {
        const saved = await applyFix(doc);
        if (saved) {
          fixedCount += 1;
          console.log('       ✓ fixed');
        }
      }
    }
    console.log('');
  }

  console.log('='.repeat(72));
  console.log(`With issues: ${issueCount}/${categories.length}`);
  if (fix) {
    console.log(`Fixed:       ${fixedCount}`);
  } else if (issueCount > 0) {
    console.log('\nRun with --fix to set defaultLanguage=en and sync legacy fields from English.');
  } else {
    console.log('\n✅ All categories use English as default — admin should show English after redeploy.');
  }
  console.log('='.repeat(72));

  await mongoose.disconnect();
  process.exit(issueCount > 0 && !fix ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

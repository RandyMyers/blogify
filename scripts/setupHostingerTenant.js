/**
 * One-shot setup for the Hostinger staging tenant.
 *
 * - Ensures tenant record + domain mapping
 * - Seeds per-tenant SEO settings (siteUrl for sitemap/canonicals)
 * - Optionally moves tenant-scoped content from another tenant (default: preview)
 *
 * Usage:
 *   node server/scripts/setupHostingerTenant.js
 *   node server/scripts/setupHostingerTenant.js --from=preview
 *   node server/scripts/setupHostingerTenant.js --dry-run
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const rootEnv = path.resolve(__dirname, '..', '..', '.env');
const serverEnv = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
else if (fs.existsSync(serverEnv)) dotenv.config({ path: serverEnv });
else dotenv.config();

const Tenant = require('../models/Tenant');
const SeoSettings = require('../models/SeoSettings');
const Article = require('../models/Article');
const Ad = require('../models/Ad');
const AdEvent = require('../models/AdEvent');
const Visitor = require('../models/Visitor');

const HOSTINGER_SLUG = 'hostinger';
const HOSTINGER_DOMAIN = 'darksalmon-chinchilla-651339.hostingersite.com';
const HOSTINGER_SITE_URL = `https://${HOSTINGER_DOMAIN}`;

const DRY_RUN = process.argv.includes('--dry-run');

function parseFromSlug() {
  const arg = process.argv.find((a) => a.startsWith('--from='));
  return (arg ? arg.split('=')[1] : 'preview').toLowerCase().trim();
}

async function upsertHostingerTenant() {
  let tenant = await Tenant.findOne({ slug: HOSTINGER_SLUG });
  if (!tenant) {
    if (DRY_RUN) {
      console.log(`Would create tenant: ${HOSTINGER_SLUG}`);
      return { _id: 'dry-run-hostinger' };
    }
    tenant = await Tenant.create({
      slug: HOSTINGER_SLUG,
      name: 'Hostinger Staging',
      domains: [HOSTINGER_DOMAIN],
      isDefault: false,
      isActive: true,
    });
    console.log(`Created tenant: ${HOSTINGER_SLUG}`);
    return tenant;
  }

  tenant.name = 'Hostinger Staging';
  tenant.domains = [HOSTINGER_DOMAIN];
  tenant.isActive = true;
  tenant.isDefault = false;
  if (!DRY_RUN) await tenant.save();
  console.log(`Updated tenant: ${HOSTINGER_SLUG} → ${HOSTINGER_DOMAIN}`);
  return tenant;
}

async function seedHostingerSeo(tenantId) {
  const payload = {
    tenantId,
    siteName: 'Bloomwik',
    siteUrl: HOSTINGER_SITE_URL,
    twitterHandle: '@bloomwik',
    googleSiteVerification: '',
    bingSiteVerification: '',
    sitemap: {
      enabled: true,
      includeArticles: true,
      includeCategories: true,
      includeAuthors: true,
    },
    indexNow: {
      enabled: false,
      apiKey: '',
    },
    searchConsole: {
      autoSubmitSitemap: false,
    },
  };

  if (DRY_RUN) {
    console.log(`Would seed SEO settings siteUrl=${HOSTINGER_SITE_URL}`);
    return;
  }

  await SeoSettings.findOneAndUpdate({ tenantId }, payload, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });
  console.log(`SEO settings saved (siteUrl=${HOSTINGER_SITE_URL})`);
}

async function migrateScopedContent(fromTenantId, toTenantId) {
  const models = [
    ['Article', Article],
    ['Ad', Ad],
    ['AdEvent', AdEvent],
    ['Visitor', Visitor],
  ];

  for (const [name, Model] of models) {
    const count = await Model.countDocuments({ tenantId: fromTenantId });
    if (!count) {
      console.log(`  ${name}: none on source tenant`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`  Would move ${count} ${name} record(s) → hostinger`);
      continue;
    }
    const result = await Model.updateMany(
      { tenantId: fromTenantId },
      { $set: { tenantId: toTenantId } }
    );
    console.log(`  ${name}: moved ${result.modifiedCount || count} record(s) → hostinger`);
  }
}

async function main() {
  if (!process.env.MONGO_URL) {
    console.error('MONGO_URL is not set.');
    process.exit(1);
  }

  const fromSlug = parseFromSlug();
  const migrateContent = process.argv.includes('--migrate');
  await mongoose.connect(process.env.MONGO_URL);
  console.log('Connected to MongoDB\n');

  const hostinger = await upsertHostingerTenant();
  await seedHostingerSeo(hostinger._id);

  const source = await Tenant.findOne({ slug: fromSlug, isActive: true });
  if (!migrateContent) {
    console.log('\nSkipping content migration (pass --migrate to copy from another tenant).');
  } else if (!source) {
    console.log(`\nNo source tenant "${fromSlug}" — skipping content migration.`);
  } else if (String(source._id) === String(hostinger._id)) {
    console.log('\nSource and target tenant are the same — skipping content migration.');
  } else {
    console.log(`\nMigrating scoped content from "${fromSlug}" → "${HOSTINGER_SLUG}"…`);
    await migrateScopedContent(source._id, hostinger._id);
  }

  if (!DRY_RUN) {
    const articleCount = await Article.countDocuments({ tenantId: hostinger._id });
    console.log(`\nHostinger tenant now has ${articleCount} article(s).`);
  }

  console.log('\nNext steps:');
  console.log('  1. Redeploy server to Vercel (CORS + tenant domain)');
  console.log('  2. cd client && npm run build:hostinger');
  console.log('  3. Upload client/build/ to Hostinger');
  console.log('  4. In admin, select "Hostinger Staging" tenant to manage content\n');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Setup failed:', err.message);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});

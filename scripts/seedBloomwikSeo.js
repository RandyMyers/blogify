/**
 * Seed SEO settings for the Bloomwik tenant.
 *
 * Usage:
 *   npm run seed:bloomwik-seo
 *   node scripts/seedBloomwikSeo.js --slug=bloomwik
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

function parseArgs() {
  const slugArg = process.argv.find((a) => a.startsWith('--slug='));
  return { slug: (slugArg ? slugArg.split('=')[1] : 'bloomwik').toLowerCase().trim() };
}

const BLOOMWIK_SEO = {
  siteName: 'Bloomwik',
  siteUrl: 'https://bloomwik.com',
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
    enabled: true,
    apiKey: process.env.INDEXNOW_API_KEY || '',
  },
  searchConsole: {
    autoSubmitSitemap: false,
  },
};

async function main() {
  if (!process.env.MONGO_URL) {
    console.error('MONGO_URL is not set');
    process.exit(1);
  }

  const { slug } = parseArgs();
  await mongoose.connect(process.env.MONGO_URL);
  console.log('Connected to MongoDB\n');

  let tenant = await Tenant.findOne({ slug });
  if (!tenant) {
    tenant = await Tenant.findOne({ isDefault: true, isActive: true });
  }
  if (!tenant) {
    tenant = await Tenant.findOne({ domains: 'bloomwik.com' });
  }
  if (!tenant) {
    console.error(`Tenant not found (tried slug "${slug}", default, bloomwik.com). Run npm run setup:bloomwik first.`);
    process.exit(1);
  }

  const settings = await SeoSettings.findOneAndUpdate(
    { tenantId: tenant._id },
    { tenantId: tenant._id, ...BLOOMWIK_SEO },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log(`SEO settings saved for tenant "${tenant.name}" (${tenant.slug})`);
  console.log(`  Site URL:     ${settings.siteUrl}`);
  console.log(`  Sitemap:      ${settings.sitemap.enabled ? 'enabled' : 'disabled'}`);
  console.log(`  IndexNow:     ${settings.indexNow.enabled ? 'enabled' : 'disabled'}`);
  console.log(`  IndexNow key: ${settings.indexNow.apiKey ? '(set)' : '(empty — use INDEXNOW_API_KEY env)'}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

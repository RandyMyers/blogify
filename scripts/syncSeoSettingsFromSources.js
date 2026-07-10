/**
 * Sync SEO settings from index.html + env into all tenant SeoSettings documents.
 *
 * - Google site verification from client/public/index.html
 * - Bing verification from BING_SITE_VERIFICATION env (if set)
 * - Hreflang defaults + requireCanonicalOnPublish
 *
 * Usage:
 *   node server/scripts/syncSeoSettingsFromSources.js           # dry run
 *   node server/scripts/syncSeoSettingsFromSources.js --apply   # write
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

const APPLY = process.argv.includes('--apply');

function readGoogleVerificationFromIndexHtml() {
  const indexPath = path.resolve(__dirname, '..', '..', 'client', 'public', 'index.html');
  if (!fs.existsSync(indexPath)) return '';
  const html = fs.readFileSync(indexPath, 'utf8');
  const match = html.match(/google-site-verification"\s+content="([^"]+)"/i);
  return match?.[1]?.trim() || '';
}

async function syncSeoSettingsFromSources() {
  if (!process.env.MONGO_URL) {
    console.error('MONGO_URL is not set');
    process.exit(1);
  }

  const googleFromHtml = readGoogleVerificationFromIndexHtml();
  const googleFromEnv = process.env.GOOGLE_SITE_VERIFICATION || '';
  const bingFromEnv = process.env.BING_SITE_VERIFICATION || '';
  const googleSiteVerification = googleFromEnv || googleFromHtml;
  const siteUrl = (process.env.CLIENT_URL || 'https://bloomwik.com').replace(/\/$/, '');

  console.log(`Sources:`);
  console.log(`  siteUrl: ${siteUrl}`);
  console.log(`  google verification: ${googleSiteVerification ? '(set)' : '(empty)'}`);
  console.log(`  bing verification: ${bingFromEnv ? '(set)' : '(empty)'}`);
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`);

  await mongoose.connect(process.env.MONGO_URL);

  const tenants = await Tenant.find({});
  let updated = 0;

  for (const tenant of tenants) {
    let doc = await SeoSettings.findOne({ tenantId: tenant._id });
    if (!doc) {
      doc = new SeoSettings({ tenantId: tenant._id });
    }

    const patch = {
      siteUrl: doc.siteUrl || siteUrl,
      hreflang: {
        enabled: doc.hreflang?.enabled !== false,
        xDefaultLanguage: doc.hreflang?.xDefaultLanguage || 'en',
        includeRegionalVariants: doc.hreflang?.includeRegionalVariants !== false,
      },
      contentSeo: {
        ...(doc.contentSeo?.toObject?.() || doc.contentSeo || {}),
        requireCanonicalOnPublish: true,
      },
    };

    if (googleSiteVerification && (!doc.googleSiteVerification || APPLY)) {
      patch.googleSiteVerification = googleSiteVerification;
    }
    if (bingFromEnv && (!doc.bingSiteVerification || APPLY)) {
      patch.bingSiteVerification = bingFromEnv;
    }

    const changed =
      patch.googleSiteVerification !== doc.googleSiteVerification ||
      patch.bingSiteVerification !== doc.bingSiteVerification ||
      patch.contentSeo?.requireCanonicalOnPublish !== doc.contentSeo?.requireCanonicalOnPublish;

    if (changed) {
      if (APPLY) {
        Object.assign(doc, patch);
        doc.markModified('hreflang');
        doc.markModified('contentSeo');
        await doc.save();
        console.log(`Updated SEO settings for tenant "${tenant.name}" (${tenant.slug})`);
      } else {
        console.log(`[dry-run] Would update tenant "${tenant.name}" (${tenant.slug})`);
      }
      updated += 1;
    }
  }

  if (tenants.length === 0) {
    console.log('No tenants found — creating default SeoSettings is skipped.');
  }

  console.log(`\nDone. Tenants ${APPLY ? 'updated' : 'to update'}: ${updated}`);
  if (!APPLY) console.log('Run with --apply to write changes.');

  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  syncSeoSettingsFromSources().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { syncSeoSettingsFromSources };

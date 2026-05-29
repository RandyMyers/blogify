/**
 * Configure the default tenant for bloomwik.com (Hostinger production).
 *
 * Usage:
 *   npm run setup:bloomwik
 *   node scripts/setupBloomwikTenant.js --slug=default
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const Tenant = require('../models/Tenant');

const rootEnv = path.resolve(__dirname, '..', '..', '.env');
const serverEnv = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
else if (fs.existsSync(serverEnv)) dotenv.config({ path: serverEnv });
else dotenv.config();

const BLOOMWIK_DOMAINS = ['bloomwik.com', 'www.bloomwik.com'];

function parseArgs() {
  const slugArg = process.argv.find((a) => a.startsWith('--slug='));
  return { slug: slugArg ? slugArg.split('=')[1] : null };
}

async function main() {
  if (!process.env.MONGO_URL) {
    console.error('MONGO_URL is not set. Add it to .env or your shell environment.');
    process.exit(1);
  }

  const { slug } = parseArgs();

  await mongoose.connect(process.env.MONGO_URL);
  console.log('Connected to MongoDB\n');

  let tenant = slug
    ? await Tenant.findOne({ slug: slug.toLowerCase().trim() })
    : await Tenant.findOne({ isDefault: true });

  if (!tenant && !slug) {
    tenant = await Tenant.findOne({});
  }

  if (!tenant) {
    console.log('No tenant found — creating default Bloomwik tenant…');
    tenant = await Tenant.create({
      name: 'Bloomwik',
      slug: 'bloomwik',
      domains: BLOOMWIK_DOMAINS,
      isDefault: true,
      isActive: true,
    });
    console.log('✅ Created tenant:', tenant.slug);
  } else {
    const before = [...(tenant.domains || [])];
    const merged = [...new Set([...before, ...BLOOMWIK_DOMAINS].map((d) => d.toLowerCase().trim()).filter(Boolean))];

    if (!tenant.name || tenant.name === 'Default' || tenant.name === 'Default Website') {
      tenant.name = 'Bloomwik';
    }
    tenant.domains = merged;
    tenant.isActive = true;
    await tenant.save();

    console.log('✅ Updated tenant:', tenant.slug);
    console.log('   Name:', tenant.name);
    console.log('   Domains before:', before.length ? before.join(', ') : '(none)');
    console.log('   Domains after: ', merged.join(', '));
  }

  console.log('\n--- Next steps ---');
  console.log('1. Vercel → Settings → Environment Variables:');
  console.log('   CLIENT_URL=https://bloomwik.com');
  console.log('   ADMIN_URL=<your-admin-panel-url>');
  console.log('2. Redeploy the API on Vercel after env changes.');
  console.log('3. Upload client/build/ to Hostinger public_html.');
  console.log('4. Verify: https://bloomwik.com and API calls in browser devtools.\n');

  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error('Setup failed:', err.message);
  try {
    await mongoose.connection.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});

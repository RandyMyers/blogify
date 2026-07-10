/**
 * Verify Bloomwik go-live readiness (API health, CORS, tenant data).
 *
 * Usage:
 *   npm run verify:golive
 *   node scripts/verifyGoLive.js --api=https://blogify-sooty-one.vercel.app
 */
const https = require('https');

const DEFAULT_API = 'https://blogify-sooty-one.vercel.app';
const ORIGINS_TO_TEST = [
  'https://bloomwik.com',
  'https://www.bloomwik.com',
  'https://darksalmon-chinchilla-651339.hostingersite.com',
];

function parseArgs() {
  const apiArg = process.argv.find((a) => a.startsWith('--api='));
  return { apiBase: (apiArg ? apiArg.split('=')[1] : DEFAULT_API).replace(/\/$/, '') };
}

function request(url, { origin } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const headers = {};
    if (origin) headers.Origin = origin;

    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers,
        timeout: 25000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            cors: res.headers['access-control-allow-origin'] || null,
            body,
          });
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    req.end();
  });
}

async function main() {
  const { apiBase } = parseArgs();
  let failed = false;

  console.log(`\nBloomwik go-live verification\nAPI: ${apiBase}\n`);

  try {
    const health = await request(`${apiBase}/health`);
    console.log(`Health: ${health.status}`);
    if (health.status !== 200) failed = true;
    try {
      const parsed = JSON.parse(health.body);
      console.log(`  Database: ${parsed.database}`);
      if (parsed.database !== 'connected') {
        console.log('  ⚠ Database not connected (cold start or MONGO_URL issue)');
      }
    } catch {
      console.log('  Response:', health.body.slice(0, 120));
    }
  } catch (err) {
    console.log(`Health: FAIL — ${err.message}`);
    failed = true;
  }

  console.log('\nCORS + categories (browser-like Origin header):');
  for (const origin of ORIGINS_TO_TEST) {
    try {
      const res = await request(`${apiBase}/api/categories`, { origin });
      const ok = res.status === 200 && res.cors === origin;
      const icon = ok ? '✅' : '❌';
      console.log(`  ${icon} ${origin} → HTTP ${res.status}, ACAO: ${res.cors || '(none)'}`);
      if (!ok) {
        failed = true;
        if (res.status === 500 && !res.cors) {
          console.log('     Likely cause: API not redeployed with bloomwik CORS + CLIENT_URL env');
        }
      }
    } catch (err) {
      console.log(`  ❌ ${origin} → ${err.message}`);
      failed = true;
    }
  }

  console.log('\n--- Required Vercel steps ---');
  console.log('1. Settings → Environment Variables (Production):');
  console.log('   CLIENT_URL=https://bloomwik.com');
  console.log('   ADMIN_URL=<your Netlify admin URL>');
  console.log('2. Redeploy Production (must include server/utils/corsOrigins.js)');
  console.log('3. Re-run: npm run verify:golive\n');

  if (failed) {
    console.log('Result: NOT READY — fix items above before go-live.\n');
    process.exit(1);
  }

  console.log('Result: READY for Bloomwik frontend.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

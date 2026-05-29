# Vercel Deployment Guide — Bloomwik API

## Bloomwik production URLs

| Variable | Production value |
|----------|------------------|
| `CLIENT_URL` | `https://bloomwik.com` |
| `ADMIN_URL` | Your admin host (e.g. Netlify admin URL) |

After updating env vars, **redeploy** Production from the Vercel dashboard.

---

## Environment Variables Setup in Vercel

### Required Variables

Go to your Vercel project → **Settings → Environment Variables** → **Production**:

```
MONGO_URL=mongodb+srv://...
JWT_SECRET=your-very-strong-secret-minimum-32-characters
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CLIENT_URL=https://bloomwik.com
ADMIN_URL=https://your-admin-url.com
NODE_ENV=production
```

### Optional Variables

```
LOG_LEVEL=info
ENABLE_JOBS=false
USE_IP_API=false
JWT_EXPIRES_IN=7d
```

### Using Vercel CLI (optional)

```bash
cd server
vercel login
vercel link

vercel env add CLIENT_URL production
# enter: https://bloomwik.com

vercel env add ADMIN_URL production
# enter: your admin panel URL

vercel --prod
```

---

## Issues Fixed

1. ✅ **Logger File System Errors** - Logger now detects serverless environment and skips file logging
2. ✅ **Missing .env File** - App now handles missing .env gracefully (Vercel uses environment variables from dashboard)

---

## Environment Variables Setup in Vercel

### Required Variables

Go to your Vercel project → Settings → Environment Variables and add:

```
MONGO_URL=mongodb://your-mongodb-connection-string
JWT_SECRET=your-very-strong-secret-minimum-32-characters
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CLIENT_URL=https://your-client-url.com
ADMIN_URL=https://your-admin-url.com
NODE_ENV=production
PORT=5000
```

### Optional Variables

```
LOG_LEVEL=info
ENABLE_JOBS=false
USE_IP_API=false
```

---

## Vercel Configuration

### vercel.json (if needed)

Create `vercel.json` in server root:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "app.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "app.js"
    }
  ]
}
```

---

## Deployment Steps

1. **Push fixes to GitHub**
   ```bash
   git add .
   git commit -m "Fix logger for Vercel serverless environment"
   git push origin master
   ```

2. **Vercel will auto-deploy** (if connected to GitHub)

3. **Or deploy manually:**
   ```bash
   vercel --prod
   ```

---

## Post-Deployment Checklist

- [ ] `CLIENT_URL=https://bloomwik.com` set in Vercel
- [ ] `npm run setup:bloomwik` run (or tenant domains set in admin)
- [ ] Deployment succeeds without errors
- [ ] Health check: `https://blogify-sooty-one.vercel.app/health`
- [ ] CORS: open bloomwik.com → Network tab → API calls return 200
- [ ] New routes deployed: `/api/users`, `/api/tenants`, `AdEvent` model

---

## Troubleshooting

### Still getting logger errors?
- Ensure latest code is deployed
- Check Vercel deployment logs
- Verify `VERCEL` environment variable is automatically set by Vercel

### Database connection fails?
- Verify `MONGO_URL` is set correctly in Vercel
- Check MongoDB allows connections from Vercel's IPs
- Ensure connection string includes authentication

### API returns 404?
- Verify `vercel.json` routes are correct
- Check build logs for errors
- Ensure `app.js` is the entry point

---

## Note

The logger now:
- ✅ Detects serverless environment automatically
- ✅ Uses console transport in serverless (Vercel, Lambda)
- ✅ Only creates log files in environments with write access
- ✅ Works in both traditional servers and serverless platforms

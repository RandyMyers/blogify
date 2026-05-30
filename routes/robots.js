const express = require('express');
const router = express.Router();

/**
 * Generate robots.txt
 * Tells search engine crawlers which pages they can access
 */
router.get('/robots.txt', (req, res) => {
  // Point search engines to the frontend sitemap (bloomwik.com on Hostinger)
  const frontendUrl = process.env.CLIENT_URL || 'https://bloomwik.com';

  let robotsTxt = `# Bloomwik Robots.txt
# Allow all search engines to crawl the site

User-agent: *
Allow: /

# Disallow admin and API routes
Disallow: /api/
Disallow: /admin/
Disallow: /search
Disallow: /bookmarks
Disallow: /confirm-subscription

# Sitemap location
Sitemap: ${frontendUrl}/sitemap.xml

# Crawl delay (optional, adjust if needed)
Crawl-delay: 1
`;

  res.header('Content-Type', 'text/plain');
  res.send(robotsTxt);
});

module.exports = router;





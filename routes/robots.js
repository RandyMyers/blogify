const express = require('express');
const router = express.Router();

/**
 * Generate robots.txt
 * Tells search engine crawlers which pages they can access
 */
router.get('/robots.txt', (req, res) => {
  const baseUrl = process.env.CLIENT_URL || 'https://blogify.com';
  
  let robotsTxt = `# Blogify Robots.txt
# Allow all search engines to crawl the site

User-agent: *
Allow: /

# Disallow admin and API routes
Disallow: /api/
Disallow: /admin/

# Sitemap location
Sitemap: ${baseUrl}/sitemap.xml

# Crawl delay (optional, adjust if needed)
Crawl-delay: 1
`;

  res.header('Content-Type', 'text/plain');
  res.send(robotsTxt);
});

module.exports = router;





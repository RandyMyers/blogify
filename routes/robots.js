const express = require('express');
const router = express.Router();

/**
 * Generate robots.txt
 * Tells search engine crawlers which pages they can access
 */
router.get('/robots.txt', (req, res) => {
  // Point search engines to the frontend sitemap hosted on Netlify
  const frontendUrl = 'https://fabulous-arithmetic-400162.netlify.app';

  let robotsTxt = `# Blogify Robots.txt
# Allow all search engines to crawl the site

User-agent: *
Allow: /

# Disallow admin and API routes
Disallow: /api/
Disallow: /admin/

# Sitemap location
Sitemap: ${frontendUrl}/sitemap.xml

# Crawl delay (optional, adjust if needed)
Crawl-delay: 1
`;

  res.header('Content-Type', 'text/plain');
  res.send(robotsTxt);
});

module.exports = router;





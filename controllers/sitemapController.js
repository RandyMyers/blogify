const Article = require('../models/Article');
const Category = require('../models/Category');
const Author = require('../models/Author');
const Region = require('../models/Region');
const { getSlugForRegion, buildArticleHreflangRegions, buildArticleHreflangLinks, buildStaticHreflangLinks } = require('../utils/regionSlug');
const { pathForRegion, absUrl } = require('../utils/prerenderMeta');
const { DEFAULT_REGION_LANGUAGES } = require('../constants/regions');

// Base URL from environment or default
const BASE_URL = process.env.CLIENT_URL || 'https://bloomwik.com';

// All supported languages
const SUPPORTED_LANGUAGES = ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'];

/** Prefer catalog default language per region (always in sync with regions.json). */
function languageForRegionCode(regionCode, fallback = 'en') {
  const code = String(regionCode || '').toUpperCase();
  return DEFAULT_REGION_LANGUAGES[code] || fallback;
}

/** Preferred region URL for a content language (first catalog match, US preferred for en). */
function preferredRegionForLanguage(lang) {
  const normalized = String(lang || 'en').toLowerCase();
  const entries = Object.entries(DEFAULT_REGION_LANGUAGES);
  if (normalized === 'en' && DEFAULT_REGION_LANGUAGES.US === 'en') return 'US';
  const match = entries.find(([, language]) => String(language).toLowerCase() === normalized);
  return match ? match[0] : 'US';
}

/**
 * Generate sitemap index XML
 * Links to individual sitemaps for better organization
 */
const generateSitemapIndex = async (req, res) => {
  try {
    const regions = await Region.find({ isActive: true }).select('code');
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    // Main sitemap (home pages)
    xml += '  <sitemap>\n';
    xml += `    <loc>${BASE_URL}/sitemap-main.xml</loc>\n`;
    xml += `    <lastmod>${new Date().toISOString()}</lastmod>\n`;
    xml += '  </sitemap>\n';
    
    // Articles sitemap
    xml += '  <sitemap>\n';
    xml += `    <loc>${BASE_URL}/sitemap-articles.xml</loc>\n`;
    xml += `    <lastmod>${new Date().toISOString()}</lastmod>\n`;
    xml += '  </sitemap>\n';
    
    // Categories sitemap
    xml += '  <sitemap>\n';
    xml += `    <loc>${BASE_URL}/sitemap-categories.xml</loc>\n`;
    xml += `    <lastmod>${new Date().toISOString()}</lastmod>\n`;
    xml += '  </sitemap>\n';
    
    // Authors sitemap
    xml += '  <sitemap>\n';
    xml += `    <loc>${BASE_URL}/sitemap-authors.xml</loc>\n`;
    xml += `    <lastmod>${new Date().toISOString()}</lastmod>\n`;
    xml += '  </sitemap>\n';
    
    xml += '</sitemapindex>';
    
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('Error generating sitemap index:', error);
    res.status(500).send('Error generating sitemap');
  }
};

/**
 * Generate main sitemap (homepage and static pages)
 */
const generateMainSitemap = async (req, res) => {
  try {
    const regions = await Region.find({ isActive: true }).select('code defaultLanguage isActive').lean();

    const appendStaticUrl = (xml, pagePath, { priority, changefreq }) => {
      const hrefLinks = buildStaticHreflangLinks(regions, {
        siteUrl: BASE_URL,
        pagePath,
        includeRegionalVariants: true,
        pathForRegion,
        absUrlFn: absUrl,
      });

      const addEntry = (regionCode) => {
        const loc = absUrl(BASE_URL, pathForRegion(regionCode, pagePath));
        xml += '  <url>\n';
        xml += `    <loc>${loc}</loc>\n`;
        xml += `    <lastmod>${new Date().toISOString()}</lastmod>\n`;
        xml += `    <changefreq>${changefreq}</changefreq>\n`;
        xml += `    <priority>${priority}</priority>\n`;
        hrefLinks.forEach((link) => {
          xml += `    <xhtml:link rel="alternate" hreflang="${link.lang}" href="${link.href}" />\n`;
        });
        xml += '  </url>\n';
      };

      addEntry('US');
      regions.forEach((region) => {
        if (region.code !== 'US') addEntry(region.code);
      });

      return xml;
    };
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
    
    xml = appendStaticUrl(xml, '/', { priority: '1.0', changefreq: 'daily' });
    
    const staticPages = [
      { path: '/categories', priority: '0.8', changefreq: 'weekly' },
      { path: '/authors', priority: '0.8', changefreq: 'weekly' },
      { path: '/trending', priority: '0.7', changefreq: 'daily' },
      { path: '/about', priority: '0.6', changefreq: 'monthly' },
      { path: '/contact', priority: '0.6', changefreq: 'monthly' },
      { path: '/privacy', priority: '0.5', changefreq: 'yearly' },
      { path: '/terms', priority: '0.5', changefreq: 'yearly' },
    ];
    
    staticPages.forEach((page) => {
      xml = appendStaticUrl(xml, page.path, page);
    });
    
    xml += '</urlset>';
    
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('Error generating main sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
};

/**
 * Generate articles sitemap
 */
const generateArticlesSitemap = async (req, res) => {
  try {
    // Include all published articles (both global and region-restricted)
    // Region-restricted articles will be included for their specific regions
    const articles = await Article.find({ 
      published: true  // Fixed: use published field (boolean) instead of status
    })
    .select('baseSlug defaultLanguage translations updatedAt regionRestrictions isGlobal regionSlugs')
    .sort({ updatedAt: -1 })
    .limit(50000); // Google's limit
    
    const regions = await Region.find({ isActive: true }).select('code defaultLanguage isActive').lean();
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
    
    const articlePathBuilder = (regionCode, slug) => {
      const code = String(regionCode || 'US').toLowerCase();
      return regionCode === 'US' ? `/article/${slug}` : `/${code}/article/${slug}`;
    };
    const absSitemapUrl = (pathname) => `${BASE_URL}${pathname}`;

    articles.forEach(article => {
      const hreflangRegions = buildArticleHreflangRegions(article, regions, true);
      const hrefLinks = buildArticleHreflangLinks(article, regions, {
        siteUrl: BASE_URL,
        includeRegionalVariants: true,
        pathBuilder: articlePathBuilder,
        absUrlFn: (_, pathname) => absSitemapUrl(pathname),
      });

      Object.entries(hreflangRegions).forEach(([regionCode, info]) => {
        const loc = absSitemapUrl(articlePathBuilder(regionCode, info.slug));

        xml += '  <url>\n';
        xml += `    <loc>${loc}</loc>\n`;
        xml += `    <lastmod>${article.updatedAt.toISOString()}</lastmod>\n`;
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += '    <priority>0.8</priority>\n';

        hrefLinks.forEach((link) => {
          xml += `    <xhtml:link rel="alternate" hreflang="${link.lang}" href="${link.href}" />\n`;
        });

        xml += '  </url>\n';
      });
    });
    
    xml += '</urlset>';
    
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('Error generating articles sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
};

/**
 * Generate categories sitemap
 */
const generateCategoriesSitemap = async (req, res) => {
  try {
    const categories = await Category.find()
      .select('baseSlug defaultLanguage translations updatedAt')
      .sort({ name: 1 });
    
    const regions = await Region.find({ isActive: true }).select('code');
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
    
    categories.forEach(category => {
      const defaultSlug = category.translations[category.defaultLanguage]?.slug || category.baseSlug;
      
      // Default URL (US/English)
      xml += '  <url>\n';
      xml += `    <loc>${BASE_URL}/category/${defaultSlug}</loc>\n`;
      xml += `    <lastmod>${category.updatedAt.toISOString()}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.7</priority>\n';
      
      // Add alternate language links
      Object.keys(category.translations).forEach(lang => {
        const translation = category.translations[lang];
        if (translation && translation.slug) {
          const region = preferredRegionForLanguage(lang);
          const regionCode = region ? region.toLowerCase() : 'us';
          const catUrl = regionCode === 'us' 
            ? `${BASE_URL}/category/${translation.slug}`
            : `${BASE_URL}/${regionCode}/category/${translation.slug}`;
          xml += `    <xhtml:link rel="alternate" hreflang="${lang}" href="${catUrl}" />\n`;
        }
      });
      
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/category/${defaultSlug}" />\n`;
      xml += '  </url>\n';
      
      // Regional versions
      regions.forEach(region => {
        if (region.code !== 'US') {
          const lang = languageForRegionCode(region.code, category.defaultLanguage);
          const translation = category.translations[lang];
          
          if (translation && translation.slug) {
            const regionCode = region.code.toLowerCase();
            xml += '  <url>\n';
            xml += `    <loc>${BASE_URL}/${regionCode}/category/${translation.slug}</loc>\n`;
            xml += `    <lastmod>${category.updatedAt.toISOString()}</lastmod>\n`;
            xml += '    <changefreq>weekly</changefreq>\n';
            xml += '    <priority>0.7</priority>\n';
            
            // Add alternate language links
            Object.keys(category.translations).forEach(l => {
              const trans = category.translations[l];
              if (trans && trans.slug) {
                const r = preferredRegionForLanguage(l);
                const rCode = r ? r.toLowerCase() : 'us';
                const cUrl = rCode === 'us' 
                  ? `${BASE_URL}/category/${trans.slug}`
                  : `${BASE_URL}/${rCode}/category/${trans.slug}`;
                xml += `    <xhtml:link rel="alternate" hreflang="${l}" href="${cUrl}" />\n`;
              }
            });
            
            xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/category/${defaultSlug}" />\n`;
            xml += '  </url>\n';
          }
        }
      });
    });
    
    xml += '</urlset>';
    
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('Error generating categories sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
};

/**
 * Generate authors sitemap
 */
const generateAuthorsSitemap = async (req, res) => {
  try {
    const authors = await Author.find()
      .select('baseSlug defaultLanguage translations updatedAt')
      .sort({ name: 1 });
    
    const regions = await Region.find({ isActive: true }).select('code');
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
    
    authors.forEach(author => {
      const defaultSlug = author.translations[author.defaultLanguage]?.slug || author.baseSlug;
      
      // Default URL (US/English)
      xml += '  <url>\n';
      xml += `    <loc>${BASE_URL}/author/${defaultSlug}</loc>\n`;
      xml += `    <lastmod>${author.updatedAt.toISOString()}</lastmod>\n`;
      xml += '    <changefreq>monthly</changefreq>\n';
      xml += '    <priority>0.6</priority>\n';
      
      // Add alternate language links
      Object.keys(author.translations).forEach(lang => {
        const translation = author.translations[lang];
        if (translation && translation.slug) {
          const region = preferredRegionForLanguage(lang);
          const regionCode = region ? region.toLowerCase() : 'us';
          const authUrl = regionCode === 'us' 
            ? `${BASE_URL}/author/${translation.slug}`
            : `${BASE_URL}/${regionCode}/author/${translation.slug}`;
          xml += `    <xhtml:link rel="alternate" hreflang="${lang}" href="${authUrl}" />\n`;
        }
      });
      
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/author/${defaultSlug}" />\n`;
      xml += '  </url>\n';
      
      // Regional versions
      regions.forEach(region => {
        if (region.code !== 'US') {
          const lang = languageForRegionCode(region.code, author.defaultLanguage);
          const translation = author.translations[lang];
          
          if (translation && translation.slug) {
            const regionCode = region.code.toLowerCase();
            xml += '  <url>\n';
            xml += `    <loc>${BASE_URL}/${regionCode}/author/${translation.slug}</loc>\n`;
            xml += `    <lastmod>${author.updatedAt.toISOString()}</lastmod>\n`;
            xml += '    <changefreq>monthly</changefreq>\n';
            xml += '    <priority>0.6</priority>\n';
            
            // Add alternate language links
            Object.keys(author.translations).forEach(l => {
              const trans = author.translations[l];
              if (trans && trans.slug) {
                const r = preferredRegionForLanguage(l);
                const rCode = r ? r.toLowerCase() : 'us';
                const aUrl = rCode === 'us' 
                  ? `${BASE_URL}/author/${trans.slug}`
                  : `${BASE_URL}/${rCode}/author/${trans.slug}`;
                xml += `    <xhtml:link rel="alternate" hreflang="${l}" href="${aUrl}" />\n`;
              }
            });
            
            xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/author/${defaultSlug}" />\n`;
            xml += '  </url>\n';
          }
        }
      });
    });
    
    xml += '</urlset>';
    
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('Error generating authors sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
};

module.exports = {
  generateSitemapIndex,
  generateMainSitemap,
  generateArticlesSitemap,
  generateCategoriesSitemap,
  generateAuthorsSitemap
};

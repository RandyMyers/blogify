const Article = require('../models/Article');
const Category = require('../models/Category');
const Author = require('../models/Author');
const Region = require('../models/Region');

// Base URL from environment or default
const BASE_URL = process.env.CLIENT_URL || 'https://blogify.com';

// All supported languages
const SUPPORTED_LANGUAGES = ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'];

// Region to language mapping
const REGION_LANGUAGE_MAP = {
  'US': 'en',
  'GB': 'en',
  'CA': 'en',
  'AU': 'en',
  'IE': 'en',
  'FR': 'fr',
  'LU': 'fr',
  'BE': 'nl',
  'NL': 'nl',
  'ES': 'es',
  'DE': 'de',
  'CH': 'de',
  'AT': 'de',
  'IT': 'it',
  'PT': 'pt',
  'SE': 'sv',
  'FI': 'fi',
  'DK': 'da',
  'NO': 'no'
};

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
    const regions = await Region.find({ isActive: true }).select('code');
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
    
    // Homepage - US/English as default (x-default)
    xml += '  <url>\n';
    xml += `    <loc>${BASE_URL}/</loc>\n`;
    xml += `    <lastmod>${new Date().toISOString()}</lastmod>\n`;
    xml += '    <changefreq>daily</changefreq>\n';
    xml += '    <priority>1.0</priority>\n';
    
    // Add alternate language links for homepage
    regions.forEach(region => {
      const lang = REGION_LANGUAGE_MAP[region.code] || 'en';
      const regionUrl = region.code === 'US' ? BASE_URL : `${BASE_URL}/${region.code.toLowerCase()}`;
      xml += `    <xhtml:link rel="alternate" hreflang="${lang}" href="${regionUrl}/" />\n`;
    });
    xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/" />\n`;
    xml += '  </url>\n';
    
    // Regional homepages (excluding US which is the default)
    regions.forEach(region => {
      if (region.code !== 'US') {
        const lang = REGION_LANGUAGE_MAP[region.code] || 'en';
        const regionCode = region.code.toLowerCase();
        
        xml += '  <url>\n';
        xml += `    <loc>${BASE_URL}/${regionCode}</loc>\n`;
        xml += `    <lastmod>${new Date().toISOString()}</lastmod>\n`;
        xml += '    <changefreq>daily</changefreq>\n';
        xml += '    <priority>0.9</priority>\n';
        
        // Add alternate language links
        regions.forEach(r => {
          const l = REGION_LANGUAGE_MAP[r.code] || 'en';
          const rUrl = r.code === 'US' ? BASE_URL : `${BASE_URL}/${r.code.toLowerCase()}`;
          xml += `    <xhtml:link rel="alternate" hreflang="${l}" href="${rUrl}/" />\n`;
        });
        xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/" />\n`;
        xml += '  </url>\n';
      }
    });
    
    // Static pages (categories, authors, trending, search)
    // Note: bookmarks, confirm-subscription, 500, and 404 are excluded (they have noindex meta tags)
    const staticPages = [
      { path: 'categories', priority: '0.8', changefreq: 'weekly' },
      { path: 'authors', priority: '0.8', changefreq: 'weekly' },
      { path: 'trending', priority: '0.7', changefreq: 'daily' },
      { path: 'search', priority: '0.6', changefreq: 'daily' }, // Added search page
      { path: 'about', priority: '0.6', changefreq: 'monthly' },
      { path: 'contact', priority: '0.6', changefreq: 'monthly' },
      { path: 'privacy', priority: '0.5', changefreq: 'yearly' },
      { path: 'terms', priority: '0.5', changefreq: 'yearly' }
    ];
    
    staticPages.forEach(page => {
      // Default (US/English)
      xml += '  <url>\n';
      xml += `    <loc>${BASE_URL}/${page.path}</loc>\n`;
      xml += `    <lastmod>${new Date().toISOString()}</lastmod>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      
      // Add alternate language links
      regions.forEach(region => {
        const lang = REGION_LANGUAGE_MAP[region.code] || 'en';
        const regionUrl = region.code === 'US' ? `${BASE_URL}/${page.path}` : `${BASE_URL}/${region.code.toLowerCase()}/${page.path}`;
        xml += `    <xhtml:link rel="alternate" hreflang="${lang}" href="${regionUrl}" />\n`;
      });
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/${page.path}" />\n`;
      xml += '  </url>\n';
      
      // Regional versions
      regions.forEach(region => {
        if (region.code !== 'US') {
          const regionCode = region.code.toLowerCase();
          xml += '  <url>\n';
          xml += `    <loc>${BASE_URL}/${regionCode}/${page.path}</loc>\n`;
          xml += `    <lastmod>${new Date().toISOString()}</lastmod>\n`;
          xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
          xml += `    <priority>${page.priority}</priority>\n`;
          
          // Add alternate language links
          regions.forEach(r => {
            const l = REGION_LANGUAGE_MAP[r.code] || 'en';
            const rUrl = r.code === 'US' ? `${BASE_URL}/${page.path}` : `${BASE_URL}/${r.code.toLowerCase()}/${page.path}`;
            xml += `    <xhtml:link rel="alternate" hreflang="${l}" href="${rUrl}" />\n`;
          });
          xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/${page.path}" />\n`;
          xml += '  </url>\n';
        }
      });
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
    .select('baseSlug defaultLanguage translations updatedAt regionRestrictions isGlobal')
    .sort({ updatedAt: -1 })
    .limit(50000); // Google's limit
    
    const regions = await Region.find({ isActive: true }).select('code');
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
    
    articles.forEach(article => {
      // Determine which regions this article should appear in
      // If isGlobal is true, include in all regions
      // If isGlobal is false, only include in regionRestrictions
      const availableRegions = article.isGlobal === false && article.regionRestrictions && article.regionRestrictions.length > 0
        ? regions.filter(r => article.regionRestrictions.includes(r.code))
        : regions; // Include all regions if global or if no restrictions specified
      
      // Default URL (US/English) - only include if article is global or US is in available regions
      const defaultSlug = article.translations[article.defaultLanguage]?.slug || article.baseSlug;
      const usRegion = regions.find(r => r.code === 'US');
      const shouldIncludeDefault = article.isGlobal || (usRegion && availableRegions.some(r => r.code === 'US'));
      
      if (shouldIncludeDefault && defaultSlug) {
        xml += '  <url>\n';
        xml += `    <loc>${BASE_URL}/article/${defaultSlug}</loc>\n`;
        xml += `    <lastmod>${article.updatedAt.toISOString()}</lastmod>\n`;
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += '    <priority>0.8</priority>\n';
        
        // Add alternate language links for all available translations
        Object.keys(article.translations).forEach(lang => {
          const translation = article.translations[lang];
          if (translation && translation.slug) {
            const region = Object.keys(REGION_LANGUAGE_MAP).find(r => REGION_LANGUAGE_MAP[r] === lang);
            const regionCode = region ? region.toLowerCase() : 'us';
            const articleUrl = regionCode === 'us' 
              ? `${BASE_URL}/article/${translation.slug}`
              : `${BASE_URL}/${regionCode}/article/${translation.slug}`;
            xml += `    <xhtml:link rel="alternate" hreflang="${lang}" href="${articleUrl}" />\n`;
          }
        });
        
        xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/article/${defaultSlug}" />\n`;
        xml += '  </url>\n';
      }
      
      // Regional versions
      availableRegions.forEach(region => {
        if (region.code !== 'US') {
          const lang = REGION_LANGUAGE_MAP[region.code] || article.defaultLanguage;
          const translation = article.translations[lang];
          
          if (translation && translation.slug) {
            const regionCode = region.code.toLowerCase();
            xml += '  <url>\n';
            xml += `    <loc>${BASE_URL}/${regionCode}/article/${translation.slug}</loc>\n`;
            xml += `    <lastmod>${article.updatedAt.toISOString()}</lastmod>\n`;
            xml += '    <changefreq>weekly</changefreq>\n';
            xml += '    <priority>0.8</priority>\n';
            
            // Add alternate language links
            Object.keys(article.translations).forEach(l => {
              const trans = article.translations[l];
              if (trans && trans.slug) {
                const r = Object.keys(REGION_LANGUAGE_MAP).find(reg => REGION_LANGUAGE_MAP[reg] === l);
                const rCode = r ? r.toLowerCase() : 'us';
                const artUrl = rCode === 'us' 
                  ? `${BASE_URL}/article/${trans.slug}`
                  : `${BASE_URL}/${rCode}/article/${trans.slug}`;
                xml += `    <xhtml:link rel="alternate" hreflang="${l}" href="${artUrl}" />\n`;
              }
            });
            
            xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/article/${defaultSlug}" />\n`;
            xml += '  </url>\n';
          }
        }
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
          const region = Object.keys(REGION_LANGUAGE_MAP).find(r => REGION_LANGUAGE_MAP[r] === lang);
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
          const lang = REGION_LANGUAGE_MAP[region.code] || category.defaultLanguage;
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
                const r = Object.keys(REGION_LANGUAGE_MAP).find(reg => REGION_LANGUAGE_MAP[reg] === l);
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
          const region = Object.keys(REGION_LANGUAGE_MAP).find(r => REGION_LANGUAGE_MAP[r] === lang);
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
          const lang = REGION_LANGUAGE_MAP[region.code] || author.defaultLanguage;
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
                const r = Object.keys(REGION_LANGUAGE_MAP).find(reg => REGION_LANGUAGE_MAP[reg] === l);
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

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Article = require('../models/Article');
const Category = require('../models/Category');
const Author = require('../models/Author');

dotenv.config();

const SUPPORTED_LANGUAGES = ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'];
const LANGUAGE_NAMES = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
  sv: 'Svenska',
  fi: 'Suomi',
  da: 'Dansk',
  no: 'Norsk',
  nl: 'Nederlands'
};

// Check if a translation exists and has required fields
const hasTranslation = (item, lang, type) => {
  if (!item.translations || !item.translations[lang]) {
    return false;
  }
  
  const translation = item.translations[lang];
  
  switch (type) {
    case 'category':
      return !!(translation.name && translation.slug && translation.description);
    case 'article':
      return !!(translation.title && translation.slug && translation.excerpt && 
                translation.content && translation.metaTitle && translation.metaDescription);
    case 'author':
      return !!(translation.slug && translation.bio);
    default:
      return false;
  }
};

// Check if translation is complete (all required fields)
const isTranslationComplete = (item, lang, type) => {
  if (!item.translations || !item.translations[lang]) {
    return false;
  }
  
  const translation = item.translations[lang];
  
  switch (type) {
    case 'category':
      return !!(translation.name && translation.name.trim() && 
                translation.slug && translation.slug.trim() && 
                translation.description && translation.description.trim());
    case 'article':
      return !!(translation.title && translation.title.trim() && 
                translation.slug && translation.slug.trim() && 
                translation.excerpt && translation.excerpt.trim() && 
                translation.content && translation.content.length > 0 &&
                translation.metaTitle && translation.metaTitle.trim() && 
                translation.metaDescription && translation.metaDescription.trim());
    case 'author':
      return !!(translation.slug && translation.slug.trim() && 
                translation.bio && translation.bio.trim());
    default:
      return false;
  }
};

const analyzeTranslations = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB\n');

    const report = {
      categories: { total: 0, byLanguage: {}, missing: [] },
      articles: { total: 0, byLanguage: {}, missing: [] },
      authors: { total: 0, byLanguage: {}, missing: [] },
      summary: {
        totalItems: 0,
        totalTranslations: 0,
        expectedTranslations: 0,
        missingTranslations: 0,
        completionRate: 0
      }
    };

    // Analyze Categories
    console.log('📊 Analyzing Categories...');
    const categories = await Category.find({});
    report.categories.total = categories.length;
    
    SUPPORTED_LANGUAGES.forEach(lang => {
      report.categories.byLanguage[lang] = {
        total: 0,
        complete: 0,
        partial: 0,
        missing: 0,
        items: []
      };
    });

    categories.forEach(category => {
      SUPPORTED_LANGUAGES.forEach(lang => {
        if (hasTranslation(category, lang, 'category')) {
          report.categories.byLanguage[lang].total++;
          if (isTranslationComplete(category, lang, 'category')) {
            report.categories.byLanguage[lang].complete++;
          } else {
            report.categories.byLanguage[lang].partial++;
            report.categories.byLanguage[lang].items.push({
              id: category._id.toString(),
              baseSlug: category.baseSlug,
              name: category.translations[lang].name || 'N/A',
              status: 'partial'
            });
          }
        } else {
          report.categories.byLanguage[lang].missing++;
          report.categories.missing.push({
            categoryId: category._id.toString(),
            baseSlug: category.baseSlug,
            defaultName: category.translations[category.defaultLanguage]?.name || category.name || 'N/A',
            missingLanguage: lang
          });
        }
      });
    });

    // Analyze Articles
    console.log('📊 Analyzing Articles...');
    const articles = await Article.find({});
    report.articles.total = articles.length;
    
    SUPPORTED_LANGUAGES.forEach(lang => {
      report.articles.byLanguage[lang] = {
        total: 0,
        complete: 0,
        partial: 0,
        missing: 0,
        items: []
      };
    });

    articles.forEach(article => {
      SUPPORTED_LANGUAGES.forEach(lang => {
        if (hasTranslation(article, lang, 'article')) {
          report.articles.byLanguage[lang].total++;
          if (isTranslationComplete(article, lang, 'article')) {
            report.articles.byLanguage[lang].complete++;
          } else {
            report.articles.byLanguage[lang].partial++;
            report.articles.byLanguage[lang].items.push({
              id: article._id.toString(),
              baseSlug: article.baseSlug,
              title: article.translations[lang].title || 'N/A',
              status: 'partial'
            });
          }
        } else {
          report.articles.byLanguage[lang].missing++;
          report.articles.missing.push({
            articleId: article._id.toString(),
            baseSlug: article.baseSlug,
            defaultTitle: article.translations[article.defaultLanguage]?.title || article.title || 'N/A',
            missingLanguage: lang
          });
        }
      });
    });

    // Analyze Authors
    console.log('📊 Analyzing Authors...');
    const authors = await Author.find({});
    report.authors.total = authors.length;
    
    SUPPORTED_LANGUAGES.forEach(lang => {
      report.authors.byLanguage[lang] = {
        total: 0,
        complete: 0,
        partial: 0,
        missing: 0,
        items: []
      };
    });

    authors.forEach(author => {
      SUPPORTED_LANGUAGES.forEach(lang => {
        if (hasTranslation(author, lang, 'author')) {
          report.authors.byLanguage[lang].complete++;
          report.authors.byLanguage[lang].total++;
        } else {
          report.authors.byLanguage[lang].missing++;
          report.authors.missing.push({
            authorId: author._id.toString(),
            name: author.name,
            baseSlug: author.baseSlug,
            missingLanguage: lang
          });
        }
      });
    });

    // Calculate summary
    report.summary.totalItems = report.categories.total + report.articles.total + report.authors.total;
    report.summary.expectedTranslations = report.summary.totalItems * SUPPORTED_LANGUAGES.length;
    
    let totalComplete = 0;
    SUPPORTED_LANGUAGES.forEach(lang => {
      totalComplete += report.categories.byLanguage[lang].complete;
      totalComplete += report.articles.byLanguage[lang].complete;
      totalComplete += report.authors.byLanguage[lang].complete;
    });
    
    report.summary.totalTranslations = totalComplete;
    report.summary.missingTranslations = report.summary.expectedTranslations - report.summary.totalTranslations;
    report.summary.completionRate = ((report.summary.totalTranslations / report.summary.expectedTranslations) * 100).toFixed(2);

    // Print Report
    console.log('\n' + '='.repeat(80));
    console.log('📋 TRANSLATION ANALYSIS REPORT');
    console.log('='.repeat(80) + '\n');

    console.log('📊 SUMMARY');
    console.log('-'.repeat(80));
    console.log(`Total Items: ${report.summary.totalItems}`);
    console.log(`  - Categories: ${report.categories.total}`);
    console.log(`  - Articles: ${report.articles.total}`);
    console.log(`  - Authors: ${report.authors.total}`);
    console.log(`\nExpected Translations: ${report.summary.expectedTranslations}`);
    console.log(`Complete Translations: ${report.summary.totalTranslations}`);
    console.log(`Missing Translations: ${report.summary.missingTranslations}`);
    console.log(`Completion Rate: ${report.summary.completionRate}%\n`);

    console.log('📝 BY LANGUAGE BREAKDOWN');
    console.log('-'.repeat(80));
    SUPPORTED_LANGUAGES.forEach(lang => {
      const catStats = report.categories.byLanguage[lang];
      const artStats = report.articles.byLanguage[lang];
      const authStats = report.authors.byLanguage[lang];
      const totalComplete = catStats.complete + artStats.complete + authStats.complete;
      const totalExpected = report.categories.total + report.articles.total + report.authors.total;
      const langRate = ((totalComplete / totalExpected) * 100).toFixed(1);
      
      console.log(`\n${LANGUAGE_NAMES[lang]} (${lang.toUpperCase()}):`);
      console.log(`  Categories: ${catStats.complete}/${report.categories.total} complete, ${catStats.partial} partial, ${catStats.missing} missing`);
      console.log(`  Articles: ${artStats.complete}/${report.articles.total} complete, ${artStats.partial} partial, ${artStats.missing} missing`);
      console.log(`  Authors: ${authStats.complete}/${report.authors.total} complete, ${authStats.missing} missing`);
      console.log(`  Overall: ${totalComplete}/${totalExpected} (${langRate}%)`);
    });

    console.log('\n\n⚠️  MISSING TRANSLATIONS');
    console.log('-'.repeat(80));
    
    // Categories missing translations
    if (report.categories.missing.length > 0) {
      console.log(`\n📁 Categories Missing Translations (${report.categories.missing.length} total):`);
      const missingByLang = {};
      report.categories.missing.forEach(item => {
        if (!missingByLang[item.missingLanguage]) {
          missingByLang[item.missingLanguage] = [];
        }
        missingByLang[item.missingLanguage].push(item);
      });
      
      Object.keys(missingByLang).sort().forEach(lang => {
        console.log(`\n  ${LANGUAGE_NAMES[lang]} (${lang.toUpperCase()}): ${missingByLang[lang].length} categories`);
        missingByLang[lang].slice(0, 5).forEach(item => {
          console.log(`    - ${item.defaultName} (${item.baseSlug})`);
        });
        if (missingByLang[lang].length > 5) {
          console.log(`    ... and ${missingByLang[lang].length - 5} more`);
        }
      });
    }

    // Articles missing translations
    if (report.articles.missing.length > 0) {
      console.log(`\n📄 Articles Missing Translations (${report.articles.missing.length} total):`);
      const missingByLang = {};
      report.articles.missing.forEach(item => {
        if (!missingByLang[item.missingLanguage]) {
          missingByLang[item.missingLanguage] = [];
        }
        missingByLang[item.missingLanguage].push(item);
      });
      
      Object.keys(missingByLang).sort().forEach(lang => {
        console.log(`\n  ${LANGUAGE_NAMES[lang]} (${lang.toUpperCase()}): ${missingByLang[lang].length} articles`);
        missingByLang[lang].slice(0, 5).forEach(item => {
          console.log(`    - ${item.defaultTitle} (${item.baseSlug})`);
        });
        if (missingByLang[lang].length > 5) {
          console.log(`    ... and ${missingByLang[lang].length - 5} more`);
        }
      });
    }

    // Authors missing translations
    if (report.authors.missing.length > 0) {
      console.log(`\n👤 Authors Missing Translations (${report.authors.missing.length} total):`);
      const missingByLang = {};
      report.authors.missing.forEach(item => {
        if (!missingByLang[item.missingLanguage]) {
          missingByLang[item.missingLanguage] = [];
        }
        missingByLang[item.missingLanguage].push(item);
      });
      
      Object.keys(missingByLang).sort().forEach(lang => {
        console.log(`\n  ${LANGUAGE_NAMES[lang]} (${lang.toUpperCase()}): ${missingByLang[lang].length} authors`);
        missingByLang[lang].forEach(item => {
          console.log(`    - ${item.name} (${item.baseSlug})`);
        });
      });
    }

    console.log('\n\n✅ RECOMMENDATIONS');
    console.log('-'.repeat(80));
    
    // Find languages with lowest completion rates
    const langRates = SUPPORTED_LANGUAGES.map(lang => {
      const catStats = report.categories.byLanguage[lang];
      const artStats = report.articles.byLanguage[lang];
      const authStats = report.authors.byLanguage[lang];
      const totalComplete = catStats.complete + artStats.complete + authStats.complete;
      const totalExpected = report.categories.total + report.articles.total + report.authors.total;
      return {
        lang,
        rate: (totalComplete / totalExpected) * 100,
        missing: totalExpected - totalComplete
      };
    }).sort((a, b) => a.rate - b.rate);

    console.log('\nPriority Languages (Lowest Completion):');
    langRates.slice(0, 5).forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${LANGUAGE_NAMES[item.lang]} (${item.lang.toUpperCase()}): ${item.rate.toFixed(1)}% complete, ${item.missing} missing`);
    });

    console.log('\n\n📋 ACTION ITEMS');
    console.log('-'.repeat(80));
    console.log('1. Complete category translations for all languages');
    console.log('2. Translate articles (currently only first 3 have all languages)');
    console.log('3. Translate author bios for all languages');
    console.log('4. Review and complete partial translations');
    console.log('5. Consider using translation services or professional translators');

    console.log('\n' + '='.repeat(80));
    console.log('Report generated successfully!');
    console.log('='.repeat(80) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('Error analyzing translations:', error);
    process.exit(1);
  }
};

analyzeTranslations();


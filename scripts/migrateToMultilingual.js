const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Article = require('../models/Article');
const Category = require('../models/Category');
const Author = require('../models/Author');

dotenv.config();

/**
 * Migration script to convert existing articles, categories, and authors
 * to the new multilingual structure
 */
const migrateArticles = async () => {
  console.log('Starting article migration...');
  const articles = await Article.find({});
  let migrated = 0;
  let skipped = 0;
  
  for (const article of articles) {
    try {
      // Skip if already migrated (has baseSlug and translations)
      if (article.baseSlug && article.translations && article.translations.en) {
        console.log(`Skipping article ${article._id} - already migrated`);
        skipped++;
        continue;
      }
      
      // Move existing fields to translations.en
      if (!article.translations) {
        article.translations = {};
      }
      
      if (!article.translations.en) {
        article.translations.en = {};
      }
      
      // Migrate title, excerpt, content, SEO
      if (article.title && !article.translations.en.title) {
        article.translations.en.title = article.title;
      }
      
      if (article.excerpt && !article.translations.en.excerpt) {
        article.translations.en.excerpt = article.excerpt;
      }
      
      if (article.content && !article.translations.en.content) {
        article.translations.en.content = article.content;
      }
      
      if (article.slug && !article.translations.en.slug) {
        article.translations.en.slug = article.slug;
      }
      
      // Migrate SEO fields
      if (article.seo) {
        if (article.seo.metaTitle && !article.translations.en.metaTitle) {
          article.translations.en.metaTitle = article.seo.metaTitle;
        }
        if (article.seo.metaDescription && !article.translations.en.metaDescription) {
          article.translations.en.metaDescription = article.seo.metaDescription;
        }
        if (article.seo.keywords && !article.translations.en.keywords) {
          article.translations.en.keywords = article.seo.keywords;
        }
      }
      
      // Set baseSlug
      if (!article.baseSlug) {
        article.baseSlug = article.slug || article.translations.en.slug;
      }
      
      // Set default language
      if (!article.defaultLanguage) {
        article.defaultLanguage = 'en';
      }
      
      // Set as global (all existing articles are global)
      if (article.isGlobal === undefined) {
        article.isGlobal = true;
      }
      
      if (!article.regionRestrictions) {
        article.regionRestrictions = [];
      }
      
      await article.save();
      migrated++;
      
      if (migrated % 10 === 0) {
        console.log(`Migrated ${migrated} articles...`);
      }
    } catch (error) {
      console.error(`Error migrating article ${article._id}:`, error.message);
    }
  }
  
  console.log(`Article migration complete: ${migrated} migrated, ${skipped} skipped`);
};

const migrateCategories = async () => {
  console.log('Starting category migration...');
  const categories = await Category.find({});
  let migrated = 0;
  let skipped = 0;
  
  for (const category of categories) {
    try {
      // Skip if already migrated
      if (category.baseSlug && category.translations && category.translations.en) {
        console.log(`Skipping category ${category._id} - already migrated`);
        skipped++;
        continue;
      }
      
      // Move existing fields to translations.en
      if (!category.translations) {
        category.translations = {};
      }
      
      if (!category.translations.en) {
        category.translations.en = {};
      }
      
      if (category.name && !category.translations.en.name) {
        category.translations.en.name = category.name;
      }
      
      if (category.description && !category.translations.en.description) {
        category.translations.en.description = category.description;
      }
      
      if (category.slug && !category.translations.en.slug) {
        category.translations.en.slug = category.slug;
      }
      
      // Set baseSlug
      if (!category.baseSlug) {
        category.baseSlug = category.slug || category.translations.en.slug;
      }
      
      // Set default language
      if (!category.defaultLanguage) {
        category.defaultLanguage = 'en';
      }
      
      await category.save();
      migrated++;
      
      if (migrated % 10 === 0) {
        console.log(`Migrated ${migrated} categories...`);
      }
    } catch (error) {
      console.error(`Error migrating category ${category._id}:`, error.message);
    }
  }
  
  console.log(`Category migration complete: ${migrated} migrated, ${skipped} skipped`);
};

const migrateAuthors = async () => {
  console.log('Starting author migration...');
  const authors = await Author.find({});
  let migrated = 0;
  let skipped = 0;
  
  for (const author of authors) {
    try {
      // Skip if already migrated
      if (author.baseSlug && author.translations && author.translations.en) {
        console.log(`Skipping author ${author._id} - already migrated`);
        skipped++;
        continue;
      }
      
      // Move existing fields to translations.en
      if (!author.translations) {
        author.translations = {};
      }
      
      if (!author.translations.en) {
        author.translations.en = {};
      }
      
      if (author.bio && !author.translations.en.bio) {
        author.translations.en.bio = author.bio;
      }
      
      if (author.slug && !author.translations.en.slug) {
        author.translations.en.slug = author.slug;
      }
      
      // Set baseSlug
      if (!author.baseSlug) {
        author.baseSlug = author.slug || author.translations.en.slug;
      }
      
      // Set default language
      if (!author.defaultLanguage) {
        author.defaultLanguage = 'en';
      }
      
      await author.save();
      migrated++;
      
      if (migrated % 10 === 0) {
        console.log(`Migrated ${migrated} authors...`);
      }
    } catch (error) {
      console.error(`Error migrating author ${author._id}:`, error.message);
    }
  }
  
  console.log(`Author migration complete: ${migrated} migrated, ${skipped} skipped`);
};

const runMigration = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');
    console.log('Starting migration to multilingual structure...\n');
    
    await migrateArticles();
    console.log('');
    await migrateCategories();
    console.log('');
    await migrateAuthors();
    console.log('');
    
    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

// Run migration if called directly
if (require.main === module) {
  runMigration();
}

module.exports = { migrateArticles, migrateCategories, migrateAuthors, runMigration };










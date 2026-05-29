const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Article = require('../models/Article');
const generateSlug = require('../utils/generateSlug');

dotenv.config({ path: path.join(__dirname, '../.env') });

const TITLE_EN = 'Ultimate Style Guide: Leather Jackets, Woolen Dresses & Timeless Wardrobe Essentials';

const translations = {
  fr: {
    title: 'Guide Ultime: Vestes en cuir, robes en laine et essentiels mode',
    excerpt: 'Decouvrez des vestes en cuir retro, des robes en laine elegantes, des blouses brodees et des guides robe manches longues.',
    metaTitle: 'Vestes en cuir et robes en laine | Trouvailles mode 2026'
  },
  es: {
    title: 'Guia definitiva: Chaquetas de cuero, vestidos de lana y basicos atemporales',
    excerpt: 'Descubre chaquetas de cuero retro, vestidos de lana elegantes, blusas bordadas y guias de vestidos de manga larga.',
    metaTitle: 'Chaquetas de cuero y vestidos de lana | Moda 2026'
  },
  de: {
    title: 'Ultimativer Guide: Lederjacken, Wollkleider und zeitlose Essentials',
    excerpt: 'Entdecken Sie Retro-Lederjacken, elegante Wollkleider, bestickte Blusen und Guides fuer Langarmkleider.',
    metaTitle: 'Lederjacken und Wollkleider | Modefunde 2026'
  },
  it: {
    title: 'Guida definitiva: Giacche in pelle, abiti in lana ed essenziali senza tempo',
    excerpt: 'Scopri giacche in pelle retro, abiti in lana eleganti, bluse ricamate e guide agli abiti a maniche lunghe.',
    metaTitle: 'Giacche in pelle e abiti in lana | Moda 2026'
  },
  pt: {
    title: 'Guia definitivo: Jaquetas de couro, vestidos de la e essenciais atemporais',
    excerpt: 'Descubra jaquetas de couro retro, vestidos de la elegantes, blusas bordadas e guias de vestidos de manga comprida.',
    metaTitle: 'Jaquetas de couro e vestidos de la | Moda 2026'
  },
  sv: {
    title: 'Ultimativ stilguide: Skinnjackor, ullklanningar och tidlosa plagg',
    excerpt: 'Upptack retro skinnjackor, eleganta ullklanningar, broderade blusar och guider for langarmade klanningar.',
    metaTitle: 'Skinnjackor och ullklanningar | Modefynd 2026'
  },
  fi: {
    title: 'Taydellinen tyyliopas: Nahkatakit, villamekot ja ajattomat vaatteet',
    excerpt: 'Loyda retro-nahkatakkeja, elegantteja villamekkoja, kirjailtuja puseroita ja pitkahiahaisten mekkojen oppaita.',
    metaTitle: 'Nahkatakit ja villamekot | Muoti 2026'
  },
  da: {
    title: 'Ultimativ stilguide: Laederjakker, uldkjoler og tidlose essentials',
    excerpt: 'Oplev retro laederjakker, elegante uldkjoler, broderede bluser og guides til langaermede kjoler.',
    metaTitle: 'Laederjakker og uldkjoler | Modefund 2026'
  },
  no: {
    title: 'Ultimat stilguide: Skinnjakker, ullkjoler og tidlose garderobefavoritter',
    excerpt: 'Oppdag retro skinnjakker, elegante ullkjoler, broderte bluser og guider til langermede kjoler.',
    metaTitle: 'Skinnjakker og ullkjoler | Motefunn 2026'
  },
  nl: {
    title: 'Ultieme stijlgids: Leren jassen, wollen jurken en tijdloze essentials',
    excerpt: 'Ontdek retro leren jassen, elegante wollen jurken, geborduurde blouses en gidsen voor jurken met lange mouwen.',
    metaTitle: 'Leren jassen en wollen jurken | Modevondsten 2026'
  }
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URL);
  const article = await Article.findOne({ 'translations.en.title': TITLE_EN });

  if (!article) {
    throw new Error('Fashion article not found. Seed article first.');
  }

  const sourceContent = article.translations.en.content || article.content || [];
  const sourceKeywords = article.translations.en.keywords || article.tags || [];

  Object.keys(translations).forEach((lang) => {
    const t = translations[lang];
    article.translations[lang] = {
      title: t.title,
      slug: generateSlug(t.title),
      excerpt: t.excerpt,
      content: Array.isArray(sourceContent) ? sourceContent : [String(sourceContent)],
      metaTitle: t.metaTitle,
      metaDescription: t.excerpt.slice(0, 160),
      keywords: sourceKeywords
    };
  });

  article.markModified('translations');
  await article.save();

  const available = Object.keys(article.translations).filter(
    (lang) => article.translations[lang] && article.translations[lang].title
  );

  console.log(`Updated translations for: ${available.join(', ')}`);
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

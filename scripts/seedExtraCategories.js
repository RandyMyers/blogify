/* eslint-disable no-console */
/**
 * Non-destructive category seeder.
 *
 * Adds new categories to the default tenant WITHOUT touching existing
 * categories, articles, authors, or users. Safe to run multiple times:
 * a category is only created if one with the same baseSlug does not already
 * exist for the tenant.
 *
 * Usage:  node scripts/seedExtraCategories.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Category = require('../models/Category');
const Tenant = require('../models/Tenant');
const generateSlug = require('../utils/generateSlug');

const SUPPORTED_LANGUAGES = ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'];

// New categories with translations for all 11 supported languages.
const NEW_CATEGORIES = [
  {
    baseSlug: 'entertainment',
    color: 'violet',
    translations: {
      en: { name: 'Entertainment', description: 'Movies, TV, streaming, music, and pop culture' },
      fr: { name: 'Divertissement', description: 'Films, séries, streaming, musique et culture pop' },
      es: { name: 'Entretenimiento', description: 'Películas, TV, streaming, música y cultura pop' },
      de: { name: 'Unterhaltung', description: 'Filme, TV, Streaming, Musik und Popkultur' },
      it: { name: 'Intrattenimento', description: 'Film, TV, streaming, musica e cultura pop' },
      pt: { name: 'Entretenimento', description: 'Filmes, TV, streaming, música e cultura pop' },
      sv: { name: 'Underhållning', description: 'Filmer, TV, streaming, musik och populärkultur' },
      fi: { name: 'Viihde', description: 'Elokuvat, TV, suoratoisto, musiikki ja populaarikulttuuri' },
      da: { name: 'Underholdning', description: 'Film, TV, streaming, musik og popkultur' },
      no: { name: 'Underholdning', description: 'Filmer, TV, streaming, musikk og populærkultur' },
      nl: { name: 'Entertainment', description: 'Films, tv, streaming, muziek en popcultuur' },
    },
  },
  {
    baseSlug: 'food-drink',
    color: 'coral',
    translations: {
      en: { name: 'Food & Drink', description: 'Recipes, restaurants, and nutrition' },
      fr: { name: 'Cuisine & Boissons', description: 'Recettes, restaurants et nutrition' },
      es: { name: 'Comida y Bebida', description: 'Recetas, restaurantes y nutrición' },
      de: { name: 'Essen & Trinken', description: 'Rezepte, Restaurants und Ernährung' },
      it: { name: 'Cibo e Bevande', description: 'Ricette, ristoranti e nutrizione' },
      pt: { name: 'Comida e Bebida', description: 'Receitas, restaurantes e nutrição' },
      sv: { name: 'Mat & Dryck', description: 'Recept, restauranger och näring' },
      fi: { name: 'Ruoka & Juoma', description: 'Reseptit, ravintolat ja ravitsemus' },
      da: { name: 'Mad & Drikke', description: 'Opskrifter, restauranter og ernæring' },
      no: { name: 'Mat & Drikke', description: 'Oppskrifter, restauranter og ernæring' },
      nl: { name: 'Eten & Drinken', description: 'Recepten, restaurants en voeding' },
    },
  },
  {
    baseSlug: 'finance',
    color: 'emerald',
    translations: {
      en: { name: 'Finance', description: 'Personal finance, investing, and money tips' },
      fr: { name: 'Finance', description: 'Finances personnelles, investissement et conseils argent' },
      es: { name: 'Finanzas', description: 'Finanzas personales, inversión y consejos de dinero' },
      de: { name: 'Finanzen', description: 'Persönliche Finanzen, Investitionen und Geldtipps' },
      it: { name: 'Finanza', description: 'Finanza personale, investimenti e consigli sul denaro' },
      pt: { name: 'Finanças', description: 'Finanças pessoais, investimento e dicas de dinheiro' },
      sv: { name: 'Ekonomi', description: 'Privatekonomi, investeringar och pengatips' },
      fi: { name: 'Talous', description: 'Henkilökohtainen talous, sijoittaminen ja rahavinkit' },
      da: { name: 'Økonomi', description: 'Privatøkonomi, investering og pengetips' },
      no: { name: 'Økonomi', description: 'Privatøkonomi, investering og pengetips' },
      nl: { name: 'Financiën', description: 'Persoonlijke financiën, beleggen en geldtips' },
    },
  },
  {
    baseSlug: 'beauty',
    color: 'amber',
    translations: {
      en: { name: 'Beauty', description: 'Skincare, makeup, and grooming' },
      fr: { name: 'Beauté', description: 'Soins de la peau, maquillage et soins' },
      es: { name: 'Belleza', description: 'Cuidado de la piel, maquillaje y cuidado personal' },
      de: { name: 'Schönheit', description: 'Hautpflege, Make-up und Pflege' },
      it: { name: 'Bellezza', description: 'Cura della pelle, trucco e cura personale' },
      pt: { name: 'Beleza', description: 'Cuidados com a pele, maquiagem e cuidados pessoais' },
      sv: { name: 'Skönhet', description: 'Hudvård, smink och skönhetsvård' },
      fi: { name: 'Kauneus', description: 'Ihonhoito, meikit ja kauneudenhoito' },
      da: { name: 'Skønhed', description: 'Hudpleje, makeup og pleje' },
      no: { name: 'Skjønnhet', description: 'Hudpleie, sminke og pleie' },
      nl: { name: 'Schoonheid', description: 'Huidverzorging, make-up en verzorging' },
    },
  },
  {
    baseSlug: 'health-fitness',
    color: 'teal',
    translations: {
      en: { name: 'Health & Fitness', description: 'Exercise, nutrition, and healthy living' },
      fr: { name: 'Santé & Fitness', description: 'Exercice, nutrition et vie saine' },
      es: { name: 'Salud y Fitness', description: 'Ejercicio, nutrición y vida saludable' },
      de: { name: 'Gesundheit & Fitness', description: 'Bewegung, Ernährung und gesundes Leben' },
      it: { name: 'Salute e Fitness', description: 'Esercizio, nutrizione e vita sana' },
      pt: { name: 'Saúde e Fitness', description: 'Exercício, nutrição e vida saudável' },
      sv: { name: 'Hälsa & Träning', description: 'Träning, kost och hälsosamt liv' },
      fi: { name: 'Terveys & Kunto', description: 'Liikunta, ravinto ja terveellinen elämä' },
      da: { name: 'Sundhed & Fitness', description: 'Motion, ernæring og sundt liv' },
      no: { name: 'Helse & Trening', description: 'Trening, ernæring og sunt liv' },
      nl: { name: 'Gezondheid & Fitness', description: 'Beweging, voeding en gezond leven' },
    },
  },
  {
    baseSlug: 'sports',
    color: 'sky',
    translations: {
      en: { name: 'Sports', description: 'News, analysis, and athlete stories' },
      fr: { name: 'Sport', description: "Actualités, analyses et histoires d'athlètes" },
      es: { name: 'Deportes', description: 'Noticias, análisis e historias de atletas' },
      de: { name: 'Sport', description: 'Nachrichten, Analysen und Sportlergeschichten' },
      it: { name: 'Sport', description: 'Notizie, analisi e storie di atleti' },
      pt: { name: 'Esportes', description: 'Notícias, análises e histórias de atletas' },
      sv: { name: 'Sport', description: 'Nyheter, analyser och idrottarberättelser' },
      fi: { name: 'Urheilu', description: 'Uutiset, analyysit ja urheilijatarinat' },
      da: { name: 'Sport', description: 'Nyheder, analyser og atletfortællinger' },
      no: { name: 'Sport', description: 'Nyheter, analyser og utøverhistorier' },
      nl: { name: 'Sport', description: 'Nieuws, analyses en verhalen van atleten' },
    },
  },
  {
    baseSlug: 'education',
    color: 'violet',
    translations: {
      en: { name: 'Education', description: 'Learning, study tips, and skills' },
      fr: { name: 'Éducation', description: "Apprentissage, conseils d'étude et compétences" },
      es: { name: 'Educación', description: 'Aprendizaje, consejos de estudio y habilidades' },
      de: { name: 'Bildung', description: 'Lernen, Lerntipps und Fähigkeiten' },
      it: { name: 'Istruzione', description: 'Apprendimento, consigli di studio e competenze' },
      pt: { name: 'Educação', description: 'Aprendizagem, dicas de estudo e habilidades' },
      sv: { name: 'Utbildning', description: 'Lärande, studietips och färdigheter' },
      fi: { name: 'Koulutus', description: 'Oppiminen, opiskeluvinkit ja taidot' },
      da: { name: 'Uddannelse', description: 'Læring, studietips og færdigheder' },
      no: { name: 'Utdanning', description: 'Læring, studietips og ferdigheter' },
      nl: { name: 'Onderwijs', description: 'Leren, studietips en vaardigheden' },
    },
  },
  {
    baseSlug: 'culture-arts',
    color: 'coral',
    translations: {
      en: { name: 'Culture & Arts', description: 'Art, books, music, and creativity' },
      fr: { name: 'Culture & Arts', description: 'Art, livres, musique et créativité' },
      es: { name: 'Cultura y Arte', description: 'Arte, libros, música y creatividad' },
      de: { name: 'Kultur & Kunst', description: 'Kunst, Bücher, Musik und Kreativität' },
      it: { name: 'Cultura e Arte', description: 'Arte, libri, musica e creatività' },
      pt: { name: 'Cultura e Artes', description: 'Arte, livros, música e criatividade' },
      sv: { name: 'Kultur & Konst', description: 'Konst, böcker, musik och kreativitet' },
      fi: { name: 'Kulttuuri & Taide', description: 'Taide, kirjat, musiikki ja luovuus' },
      da: { name: 'Kultur & Kunst', description: 'Kunst, bøger, musik og kreativitet' },
      no: { name: 'Kultur & Kunst', description: 'Kunst, bøker, musikk og kreativitet' },
      nl: { name: 'Cultuur & Kunst', description: 'Kunst, boeken, muziek en creativiteit' },
    },
  },
  {
    baseSlug: 'gaming',
    color: 'sky',
    translations: {
      en: { name: 'Gaming', description: 'Video games, reviews, and esports' },
      fr: { name: 'Jeux vidéo', description: 'Jeux vidéo, critiques et esport' },
      es: { name: 'Videojuegos', description: 'Videojuegos, reseñas y esports' },
      de: { name: 'Gaming', description: 'Videospiele, Bewertungen und E-Sport' },
      it: { name: 'Videogiochi', description: 'Videogiochi, recensioni ed esports' },
      pt: { name: 'Jogos', description: 'Videojogos, análises e esports' },
      sv: { name: 'Spel', description: 'TV-spel, recensioner och e-sport' },
      fi: { name: 'Pelaaminen', description: 'Videopelit, arvostelut ja e-urheilu' },
      da: { name: 'Gaming', description: 'Videospil, anmeldelser og e-sport' },
      no: { name: 'Gaming', description: 'Videospill, anmeldelser og e-sport' },
      nl: { name: 'Gaming', description: 'Videogames, recensies en esports' },
    },
  },
];

const connectDB = async () => {
  const uri = process.env.MONGO_URL || process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('No MongoDB connection string found (MONGO_URL).');
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('MongoDB connected');
};

const buildTranslations = (defs) => {
  const translations = {};
  SUPPORTED_LANGUAGES.forEach((lang) => {
    const t = defs[lang] || defs.en;
    translations[lang] = {
      name: t.name,
      slug: generateSlug(t.name),
      description: t.description,
    };
  });
  return translations;
};

const run = async () => {
  try {
    await connectDB();

    const defaultTenant = await Tenant.findOne({ isDefault: true });
    if (!defaultTenant) throw new Error('No default tenant found.');
    console.log(`Default tenant: ${defaultTenant.slug} (${defaultTenant._id})`);

    let created = 0;
    let skipped = 0;

    for (const def of NEW_CATEGORIES) {
      const existing = await Category.findOne({
        tenantId: defaultTenant._id,
        baseSlug: def.baseSlug,
      });

      if (existing) {
        console.log(`• Skipped (already exists): ${def.baseSlug}`);
        skipped += 1;
        continue;
      }

      const translations = buildTranslations(def.translations);
      const enName = def.translations.en.name;

      await Category.create({
        tenantId: defaultTenant._id,
        baseSlug: def.baseSlug,
        defaultLanguage: 'en',
        translations,
        color: def.color,
        isPopular: false,
        // Legacy fields for backward compatibility
        name: enName,
        slug: def.baseSlug,
        description: def.translations.en.description,
      });

      console.log(`✓ Created: ${enName} (/${def.baseSlug}) [${def.color}]`);
      created += 1;
    }

    console.log(`\nDone. Created ${created}, skipped ${skipped} (already existed).`);
    process.exit(0);
  } catch (error) {
    console.error('Error seeding categories:', error.message);
    process.exit(1);
  }
};

run();

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import models
const Category = require('../models/Category');
const Author = require('../models/Author');
const Article = require('../models/Article');
const User = require('../models/users');
const Region = require('../models/Region');
const generateSlug = require('../utils/generateSlug');

// Supported languages
const SUPPORTED_LANGUAGES = ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'];

// Sample categories data
const categoriesData = [
  {
    name: 'Technology',
    slug: 'technology',
    description: 'Latest tech news, reviews, and insights',
    color: 'teal',
    isPopular: true
  },
  {
    name: 'Design',
    slug: 'design',
    description: 'UI/UX design, graphics, and creative inspiration',
    color: 'coral',
    isPopular: true
  },
  {
    name: 'Lifestyle',
    slug: 'lifestyle',
    description: 'Health, wellness, travel, and personal growth',
    color: 'amber',
    isPopular: true
  },
  {
    name: 'Business',
    slug: 'business',
    description: 'Entrepreneurship, finance, and career advice',
    color: 'violet',
    isPopular: true
  },
  {
    name: 'Wellness',
    slug: 'wellness',
    description: 'Mental health, fitness, and self-care',
    color: 'emerald',
    isPopular: false
  },
  {
    name: 'Travel',
    slug: 'travel',
    description: 'Destinations, tips, and travel experiences',
    color: 'sky',
    isPopular: false
  }
];

// Sample authors data
const authorsData = [
  {
    name: 'Sarah Johnson',
    slug: 'sarah-johnson',
    bio: 'Tech enthusiast and software engineer with 10+ years of experience. Passionate about web development and emerging technologies.',
    email: 'sarah.johnson@blogify.com',
    socialLinks: {
      twitter: 'https://twitter.com/sarahjohnson',
      linkedin: 'https://linkedin.com/in/sarahjohnson',
      github: 'https://github.com/sarahjohnson'
    }
  },
  {
    name: 'Michael Chen',
    slug: 'michael-chen',
    bio: 'UI/UX designer and creative director. Specializes in user-centered design and digital experiences.',
    email: 'michael.chen@blogify.com',
    socialLinks: {
      twitter: 'https://twitter.com/michaelchen',
      linkedin: 'https://linkedin.com/in/michaelchen',
      website: 'https://michaelchen.design'
    }
  },
  {
    name: 'Emily Rodriguez',
    slug: 'emily-rodriguez',
    bio: 'Lifestyle blogger and wellness coach. Sharing tips for balanced living and personal growth.',
    email: 'emily.rodriguez@blogify.com',
    socialLinks: {
      twitter: 'https://twitter.com/emilyrodriguez',
      instagram: 'https://instagram.com/emilyrodriguez'
    }
  },
  {
    name: 'David Kim',
    slug: 'david-kim',
    bio: 'Business strategist and entrepreneur. Helping startups scale and succeed.',
    email: 'david.kim@blogify.com',
    socialLinks: {
      twitter: 'https://twitter.com/davidkim',
      linkedin: 'https://linkedin.com/in/davidkim'
    }
  },
  {
    name: 'Jessica Martinez',
    slug: 'jessica-martinez',
    bio: 'Travel writer and photographer. Exploring the world one destination at a time.',
    email: 'jessica.martinez@blogify.com',
    socialLinks: {
      instagram: 'https://instagram.com/jessicamartinez',
      website: 'https://jessicamartinez.com'
    }
  }
];

// Sample articles data (will be created after categories and authors)
const articlesData = [
  {
    title: 'Building Morning Routines That Actually Stick',
    excerpt: 'Discover the science-backed strategies for creating morning routines that transform your productivity and well-being.',
    content: [
      'Morning routines have become a cornerstone of high achievers\' daily lives. But why do so many people struggle to maintain them?',
      'The key to building a morning routine that sticks isn\'t about willpower—it\'s about understanding your natural rhythms and creating systems that work with your biology, not against it.',
      'Research shows that consistency beats intensity every time. Instead of trying to cram 10 activities into your morning, focus on 2-3 core habits that align with your goals.',
      'Start small. If you want to meditate for 20 minutes, begin with 5. If you want to exercise, start with a 10-minute walk. The goal is to build the habit, not to perfect it on day one.',
      'Another crucial factor is timing. Your morning routine should start at the same time every day, even on weekends. This consistency helps regulate your circadian rhythm and makes the routine feel automatic.',
      'Finally, make it enjoyable. If you dread your morning routine, you won\'t stick with it. Find activities that energize you and align with your values. When your routine feels like a gift to yourself rather than a chore, you\'ll naturally want to maintain it.'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800',
    tags: ['productivity', 'wellness', 'habits', 'self-improvement'],
    published: true,
    featured: true,
    trending: true
  },
  {
    title: 'The Future of Web Development: Trends to Watch in 2024',
    excerpt: 'Explore the latest trends shaping web development, from AI integration to new frameworks and tools.',
    content: [
      'Web development continues to evolve at a rapid pace, with new technologies and frameworks emerging regularly. As we move through 2024, several key trends are shaping the future of how we build web applications.',
      'Artificial Intelligence is no longer a futuristic concept—it\'s here, and it\'s transforming how developers work. AI-powered code assistants are becoming standard tools, helping developers write code faster and catch bugs earlier.',
      'Serverless architecture continues to gain traction, offering developers the ability to build and deploy applications without managing servers. This approach reduces operational overhead and scales automatically with demand.',
      'WebAssembly (WASM) is opening new possibilities for running high-performance code in browsers. We\'re seeing more applications that were previously desktop-only now running smoothly in web browsers.',
      'The component-driven development model, popularized by React and Vue, is becoming the standard. This approach promotes reusability, maintainability, and better collaboration between teams.',
      'Accessibility is no longer optional. With increasing awareness and legal requirements, developers are prioritizing inclusive design from the start of every project.'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800',
    tags: ['technology', 'web-development', 'programming', 'trends'],
    published: true,
    featured: false,
    trending: true
  },
  {
    title: 'Design Systems: Creating Consistency at Scale',
    excerpt: 'Learn how design systems help teams build cohesive user experiences across products and platforms.',
    content: [
      'As products grow and teams expand, maintaining design consistency becomes increasingly challenging. Design systems provide a solution to this problem by establishing a shared language and set of components.',
      'A well-designed system includes design tokens (colors, typography, spacing), component libraries, documentation, and guidelines for usage. These elements work together to ensure consistency while allowing for flexibility.',
      'The benefits extend beyond visual consistency. Design systems improve development speed, reduce bugs, and make onboarding new team members faster. They also enable designers and developers to focus on solving user problems rather than recreating basic components.',
      'Building a design system starts with an audit of existing patterns. Identify what\'s working, what\'s inconsistent, and what\'s missing. Then, prioritize the most commonly used components and patterns.',
      'Documentation is crucial. A design system without clear documentation is like a library without a catalog. Include usage guidelines, code examples, and accessibility considerations for each component.',
      'Remember that design systems are living documents. They should evolve with your product and team needs. Regular reviews and updates ensure the system remains relevant and useful.'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800',
    tags: ['design', 'ui-ux', 'design-systems', 'productivity'],
    published: true,
    featured: false,
    trending: false
  },
  {
    title: 'Remote Work: Building Culture Across Distances',
    excerpt: 'Strategies for maintaining team culture and collaboration in remote and hybrid work environments.',
    content: [
      'Remote work has become the norm for many companies, but building and maintaining a strong company culture across distances presents unique challenges.',
      'Communication is the foundation of remote culture. Over-communicate rather than under-communicate. Use multiple channels—video calls for complex discussions, async tools for updates, and chat for quick questions.',
      'Create intentional moments for connection. Virtual coffee chats, team building activities, and regular all-hands meetings help team members feel connected beyond just work tasks.',
      'Document everything. In remote settings, you can\'t rely on hallway conversations or overheard context. Write down decisions, processes, and cultural values so everyone has access to the same information.',
      'Trust your team. Micromanagement kills remote culture. Focus on outcomes rather than hours worked. Give people autonomy and the tools they need to succeed.',
      'Finally, invest in the right tools. From project management platforms to video conferencing software, the tools you choose significantly impact how your team collaborates and feels connected.'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800',
    tags: ['business', 'remote-work', 'culture', 'leadership'],
    published: true,
    featured: false,
    trending: true
  },
  {
    title: 'Sustainable Travel: Exploring the World Responsibly',
    excerpt: 'How to travel in ways that respect local communities and minimize environmental impact.',
    content: [
      'Travel opens our minds and hearts, but it also has environmental and social impacts. Sustainable travel is about making choices that benefit both travelers and the destinations we visit.',
      'Choose destinations and accommodations that prioritize sustainability. Look for eco-certifications, support local businesses, and stay in places that give back to their communities.',
      'Transportation is one of the biggest contributors to travel\'s carbon footprint. When possible, choose trains over planes for shorter distances, and consider offsetting your carbon emissions for longer flights.',
      'Pack light and pack smart. Bring reusable items like water bottles, shopping bags, and toiletries. This reduces waste and often makes travel easier.',
      'Respect local cultures and customs. Learn a few phrases in the local language, understand cultural norms, and be mindful of how your presence affects local communities.',
      'Support local economies by eating at local restaurants, buying from local artisans, and hiring local guides. This ensures your travel dollars benefit the communities you visit.',
      'Finally, leave no trace. Whether you\'re in a city or wilderness, take only photos and leave only footprints. Preserve the beauty of destinations for future travelers and generations.'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800',
    tags: ['travel', 'sustainability', 'lifestyle', 'environment'],
    published: true,
    featured: false,
    trending: false
  },
  {
    title: 'Mindfulness in the Digital Age',
    excerpt: 'Practical techniques for staying present and reducing digital overwhelm in our connected world.',
    content: [
      'Our digital devices promise connection and productivity, but they often leave us feeling more disconnected and overwhelmed. Mindfulness offers a path back to presence and peace.',
      'Start with digital boundaries. Designate tech-free times and spaces. Maybe that\'s the first hour of your day, meal times, or your bedroom. These boundaries help you reclaim your attention.',
      'Practice single-tasking. Multitasking is a myth—our brains aren\'t designed for it. When you\'re working, work. When you\'re eating, eat. When you\'re with someone, be fully present with them.',
      'Use technology mindfully. Before opening an app or checking your phone, pause and ask: "What am I looking for?" This simple question can break the autopilot mode of endless scrolling.',
      'Meditation doesn\'t have to be complicated. Start with just 5 minutes a day. Focus on your breath, notice when your mind wanders, and gently bring it back. Apps like Headspace or Calm can guide you.',
      'Nature is one of the best antidotes to digital overwhelm. Spend time outside without your phone. Notice the sounds, smells, and sensations around you. This grounds you in the present moment.',
      'Remember that mindfulness is a practice, not a destination. Some days will be easier than others. Be kind to yourself and keep coming back to the present moment.'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800',
    tags: ['wellness', 'mindfulness', 'mental-health', 'digital-wellness'],
    published: true,
    featured: true,
    trending: false
  },
  {
    title: 'The Art of Minimalist Living',
    excerpt: 'Discover how less can be more when it comes to creating a meaningful and intentional life.',
    content: [
      'Minimalism isn\'t about deprivation—it\'s about intentionality. It\'s choosing to surround yourself only with things, activities, and people that add value to your life.',
      'Start with your physical space. Go through your belongings and ask: "Does this serve a purpose or bring me joy?" If the answer is no, consider letting it go. This process can be emotional, so be patient with yourself.',
      'Apply the same principle to your calendar. Just because you can do something doesn\'t mean you should. Learn to say no to commitments that don\'t align with your values or goals.',
      'Digital minimalism matters too. Unsubscribe from newsletters you don\'t read, delete apps you don\'t use, and organize your digital files. A cluttered digital space can be just as overwhelming as a cluttered physical one.',
      'Minimalism extends to your finances. Track your spending and identify what truly matters. Cut expenses that don\'t add value, and redirect that money toward experiences or goals that do.',
      'Remember that minimalism looks different for everyone. There\'s no magic number of items to own or rules to follow. The goal is to create space—physical, mental, and emotional—for what truly matters in your life.'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800',
    tags: ['lifestyle', 'minimalism', 'organization', 'wellness'],
    published: true,
    featured: false,
    trending: true
  },
  {
    title: 'Building Your Personal Brand in 2024',
    excerpt: 'Strategies for creating an authentic and compelling personal brand that opens doors.',
    content: [
      'In today\'s connected world, your personal brand is more important than ever. It\'s not about being famous—it\'s about being known for something specific and valuable.',
      'Start by defining your unique value proposition. What do you do better than most people? What problems do you solve? What makes your perspective unique? Answering these questions helps you craft a clear brand message.',
      'Consistency is key. Your brand should be consistent across all platforms—LinkedIn, Twitter, your website, and in-person interactions. This doesn\'t mean being the same everywhere, but rather being recognizably you.',
      'Create valuable content. Whether it\'s blog posts, videos, or social media updates, focus on providing value to your audience. Share insights, lessons learned, and helpful resources.',
      'Network authentically. Building a personal brand isn\'t about collecting followers—it\'s about building genuine relationships. Engage meaningfully with others in your field, offer help, and celebrate others\' successes.',
      'Be patient. Building a personal brand takes time. Focus on consistently showing up and providing value, and your reputation will grow organically. Authenticity and consistency will always beat shortcuts.'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800',
    tags: ['business', 'career', 'personal-branding', 'networking'],
    published: true,
    featured: false,
    trending: false
  },
  {
    title: 'The Science of Productivity: What Actually Works',
    excerpt: 'Evidence-based strategies for getting more done without burning out.',
    content: [
      'Productivity advice is everywhere, but much of it contradicts itself. Let\'s look at what science actually tells us about getting things done.',
      'The Pomodoro Technique has solid research backing. Working in focused 25-minute blocks with short breaks helps maintain concentration and prevents mental fatigue. Your brain can only maintain peak focus for so long.',
      'Time blocking is more effective than to-do lists. Instead of listing everything you need to do, schedule specific times for each task. This reduces decision fatigue and makes it more likely you\'ll actually do the work.',
      'Deep work—uninterrupted, focused work on cognitively demanding tasks—is where real progress happens. Protect blocks of time for deep work by eliminating distractions and setting boundaries.',
      'Rest is productive. Research shows that taking breaks, getting enough sleep, and allowing your mind to wander actually improves creativity and problem-solving. Overwork leads to diminishing returns.',
      'Finally, focus on systems over goals. Goals tell you where you want to go, but systems are what actually get you there. Build habits and processes that naturally move you toward your desired outcomes.'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800',
    tags: ['productivity', 'business', 'self-improvement', 'work'],
    published: true,
    featured: false,
    trending: true
  },
  {
    title: 'User Experience Design: Beyond the Interface',
    excerpt: 'Understanding how great UX extends beyond screens to create meaningful human experiences.',
    content: [
      'User experience design is often thought of as something that happens on screens, but truly great UX considers the entire journey a person takes with a product or service.',
      'Start with empathy. Understand your users\' goals, frustrations, and context. This means talking to real people, observing how they use your product, and understanding their lives beyond the moments they interact with your interface.',
      'Consider the emotional journey. How does someone feel when they first discover your product? What emotions do they experience during onboarding? How do they feel when they achieve their goal? Design for these emotional moments.',
      'Accessibility isn\'t optional. Great UX is inclusive UX. Design for people with different abilities, devices, and contexts. This doesn\'t just help those users—it often improves the experience for everyone.',
      'Micro-interactions matter. The small animations, feedback, and transitions in your interface communicate personality and provide reassurance. They\'re the difference between a product that feels polished and one that feels clunky.',
      'Test and iterate. No amount of planning replaces real user feedback. Get your designs in front of users early and often. Learn from how they actually use your product, not how you think they should use it.',
      'Remember that UX is never done. As user needs evolve and technology changes, your product should evolve too. Stay curious, keep learning, and always prioritize the human experience.'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=800',
    tags: ['design', 'ui-ux', 'user-experience', 'product-design'],
    published: true,
    featured: true,
    trending: false
  }
];

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Seed function
const seedDatabase = async () => {
  try {
    // Connect to database
    await connectDB();

    // Seed regions first (if not already seeded)
    console.log('Checking regions...');
    const regionCount = await Region.countDocuments();
    if (regionCount === 0) {
      console.log('Seeding regions...');
      const regions = [
        { code: 'US', name: 'United States', languages: ['en'], defaultLanguage: 'en', currency: 'USD', isActive: true },
        { code: 'GB', name: 'United Kingdom', languages: ['en'], defaultLanguage: 'en', currency: 'GBP', isActive: true },
        { code: 'CA', name: 'Canada', languages: ['en', 'fr'], defaultLanguage: 'en', currency: 'CAD', isActive: true },
        { code: 'AU', name: 'Australia', languages: ['en'], defaultLanguage: 'en', currency: 'AUD', isActive: true },
        { code: 'FR', name: 'France', languages: ['fr', 'en'], defaultLanguage: 'fr', currency: 'EUR', isActive: true },
        { code: 'DE', name: 'Germany', languages: ['de', 'en'], defaultLanguage: 'de', currency: 'EUR', isActive: true },
        { code: 'ES', name: 'Spain', languages: ['es', 'en'], defaultLanguage: 'es', currency: 'EUR', isActive: true },
        { code: 'IT', name: 'Italy', languages: ['it', 'en'], defaultLanguage: 'it', currency: 'EUR', isActive: true },
        { code: 'PT', name: 'Portugal', languages: ['pt', 'en'], defaultLanguage: 'pt', currency: 'EUR', isActive: true },
        { code: 'SE', name: 'Sweden', languages: ['sv', 'en'], defaultLanguage: 'sv', currency: 'SEK', isActive: true },
        { code: 'NO', name: 'Norway', languages: ['no', 'en'], defaultLanguage: 'no', currency: 'NOK', isActive: true },
        { code: 'DK', name: 'Denmark', languages: ['da', 'en'], defaultLanguage: 'da', currency: 'DKK', isActive: true },
        { code: 'FI', name: 'Finland', languages: ['fi', 'sv', 'en'], defaultLanguage: 'fi', currency: 'EUR', isActive: true },
        { code: 'BE', name: 'Belgium', languages: ['nl', 'fr', 'de', 'en'], defaultLanguage: 'nl', currency: 'EUR', isActive: true },
        { code: 'NL', name: 'Netherlands', languages: ['nl', 'en'], defaultLanguage: 'nl', currency: 'EUR', isActive: true },
        { code: 'IE', name: 'Ireland', languages: ['en'], defaultLanguage: 'en', currency: 'EUR', isActive: true },
        { code: 'LU', name: 'Luxembourg', languages: ['fr', 'de', 'en'], defaultLanguage: 'fr', currency: 'EUR', isActive: true },
        { code: 'CH', name: 'Switzerland', languages: ['de', 'fr', 'it', 'en'], defaultLanguage: 'de', currency: 'CHF', isActive: true },
        { code: 'AT', name: 'Austria', languages: ['de', 'en'], defaultLanguage: 'de', currency: 'EUR', isActive: true }
      ];
      await Region.insertMany(regions);
      console.log(`✓ Created ${regions.length} regions`);
    } else {
      console.log(`✓ Regions already exist (${regionCount} regions)`);
    }

    // Clear existing blog data (do NOT clear users or regions)
    console.log('Clearing existing blog data (categories, authors, articles)...');
    await Article.deleteMany({});
    await Category.deleteMany({});
    await Author.deleteMany({});

    // Seed categories (multilingual format with ALL 11 languages)
    console.log('Seeding categories...');
    const categoryTranslations = {
      'Technology': {
        en: { name: 'Technology', description: 'Latest tech news, reviews, and insights' },
        fr: { name: 'Technologie', description: 'Dernières nouvelles technologiques, critiques et analyses' },
        es: { name: 'Tecnología', description: 'Últimas noticias tecnológicas, reseñas e ideas' },
        de: { name: 'Technologie', description: 'Neueste Technologienachrichten, Bewertungen und Einblicke' },
        it: { name: 'Tecnologia', description: 'Ultime notizie tecnologiche, recensioni e approfondimenti' },
        pt: { name: 'Tecnologia', description: 'Últimas notícias de tecnologia, análises e insights' },
        sv: { name: 'Teknik', description: 'Senaste tekniknyheter, recensioner och insikter' },
        fi: { name: 'Teknologia', description: 'Uusimmat teknologian uutiset, arvostelut ja näkökulmat' },
        da: { name: 'Teknologi', description: 'Seneste teknologinyheder, anmeldelser og indsigt' },
        no: { name: 'Teknologi', description: 'Siste teknologinyheter, anmeldelser og innsikt' },
        nl: { name: 'Technologie', description: 'Laatste technologienieuws, recensies en inzichten' }
      },
      'Design': {
        en: { name: 'Design', description: 'UI/UX design, graphics, and creative inspiration' },
        fr: { name: 'Design', description: 'Design UI/UX, graphiques et inspiration créative' },
        es: { name: 'Diseño', description: 'Diseño UI/UX, gráficos e inspiración creativa' },
        de: { name: 'Design', description: 'UI/UX-Design, Grafik und kreative Inspiration' },
        it: { name: 'Design', description: 'Design UI/UX, grafica e ispirazione creativa' },
        pt: { name: 'Design', description: 'Design UI/UX, gráficos e inspiração criativa' },
        sv: { name: 'Design', description: 'UI/UX-design, grafik och kreativ inspiration' },
        fi: { name: 'Design', description: 'UI/UX-suunnittelu, grafiikka ja luova inspiraatio' },
        da: { name: 'Design', description: 'UI/UX-design, grafik og kreativ inspiration' },
        no: { name: 'Design', description: 'UI/UX-design, grafikk og kreativ inspirasjon' },
        nl: { name: 'Design', description: 'UI/UX-ontwerp, grafisch ontwerp en creatieve inspiratie' }
      },
      'Lifestyle': {
        en: { name: 'Lifestyle', description: 'Health, wellness, travel, and personal growth' },
        fr: { name: 'Mode de vie', description: 'Santé, bien-être, voyage et développement personnel' },
        es: { name: 'Estilo de vida', description: 'Salud, bienestar, viajes y crecimiento personal' },
        de: { name: 'Lifestyle', description: 'Gesundheit, Wellness, Reisen und persönliches Wachstum' },
        it: { name: 'Stile di vita', description: 'Salute, benessere, viaggi e crescita personale' },
        pt: { name: 'Estilo de vida', description: 'Saúde, bem-estar, viagens e crescimento pessoal' },
        sv: { name: 'Livsstil', description: 'Hälsa, välmående, resor och personlig utveckling' },
        fi: { name: 'Elämäntapa', description: 'Terveys, hyvinvointi, matkailu ja henkinen kasvu' },
        da: { name: 'Livsstil', description: 'Sundhed, wellness, rejser og personlig vækst' },
        no: { name: 'Livsstil', description: 'Helse, velvære, reiser og personlig vekst' },
        nl: { name: 'Levensstijl', description: 'Gezondheid, welzijn, reizen en persoonlijke groei' }
      },
      'Business': {
        en: { name: 'Business', description: 'Entrepreneurship, finance, and career advice' },
        fr: { name: 'Entreprise', description: 'Entrepreneuriat, finance et conseils de carrière' },
        es: { name: 'Negocios', description: 'Emprendimiento, finanzas y consejos profesionales' },
        de: { name: 'Business', description: 'Unternehmertum, Finanzen und Karriereberatung' },
        it: { name: 'Business', description: 'Imprenditorialità, finanza e consigli di carriera' },
        pt: { name: 'Negócios', description: 'Empreendedorismo, finanças e conselhos de carreira' },
        sv: { name: 'Företagande', description: 'Entreprenörskap, ekonomi och karriärråd' },
        fi: { name: 'Liiketoiminta', description: 'Yrittäjyys, rahoitus ja urakehitys' },
        da: { name: 'Forretning', description: 'Iværksætteri, finans og karriererådgivning' },
        no: { name: 'Forretning', description: 'Entreprenørskap, finans og karriereveiledning' },
        nl: { name: 'Zakelijk', description: 'Ondernemerschap, financiën en carrièreadvies' }
      },
      'Wellness': {
        en: { name: 'Wellness', description: 'Mental health, fitness, and self-care' },
        fr: { name: 'Bien-être', description: 'Santé mentale, fitness et soins personnels' },
        es: { name: 'Bienestar', description: 'Salud mental, fitness y autocuidado' },
        de: { name: 'Wellness', description: 'Psychische Gesundheit, Fitness und Selbstfürsorge' },
        it: { name: 'Benessere', description: 'Salute mentale, fitness e cura di sé' },
        pt: { name: 'Bem-estar', description: 'Saúde mental, fitness e autocuidado' },
        sv: { name: 'Välmående', description: 'Mental hälsa, fitness och självomsorg' },
        fi: { name: 'Hyvinvointi', description: 'Mielenterveys, kuntoilu ja itsehoito' },
        da: { name: 'Velvære', description: 'Mental sundhed, fitness og selvværd' },
        no: { name: 'Velvære', description: 'Mental helse, trening og selvomsorg' },
        nl: { name: 'Welzijn', description: 'Geestelijke gezondheid, fitness en zelfzorg' }
      },
      'Travel': {
        en: { name: 'Travel', description: 'Destinations, tips, and travel experiences' },
        fr: { name: 'Voyage', description: 'Destinations, conseils et expériences de voyage' },
        es: { name: 'Viajes', description: 'Destinos, consejos y experiencias de viaje' },
        de: { name: 'Reisen', description: 'Reiseziele, Tipps und Reiseerfahrungen' },
        it: { name: 'Viaggi', description: 'Destinazioni, consigli ed esperienze di viaggio' },
        pt: { name: 'Viagens', description: 'Destinos, dicas e experiências de viagem' },
        sv: { name: 'Resor', description: 'Resmål, tips och reseupplevelser' },
        fi: { name: 'Matkailu', description: 'Matkakohteet, vinkit ja matkakokemukset' },
        da: { name: 'Rejser', description: 'Rejsemål, tips og rejseoplevelser' },
        no: { name: 'Reiser', description: 'Reisemål, tips og reiseopplevelser' },
        nl: { name: 'Reizen', description: 'Bestemmingen, tips en reiservaringen' }
      }
    };

    const categoriesToInsert = categoriesData.map(cat => {
      const translations = {};
      
      // Add ALL 11 language translations
      const supportedLanguages = ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'];
      const catTrans = categoryTranslations[cat.name] || {};
      
      supportedLanguages.forEach(lang => {
        if (catTrans[lang]) {
          translations[lang] = {
            name: catTrans[lang].name,
            slug: generateSlug(catTrans[lang].name),
            description: catTrans[lang].description
          };
        } else {
          // Fallback to English if translation not available
          translations[lang] = {
          name: cat.name,
          slug: generateSlug(cat.name),
          description: cat.description
          };
        }
      });

      return {
        baseSlug: generateSlug(cat.name),
        defaultLanguage: 'en',
        translations,
      // Legacy fields for backward compatibility
      name: cat.name,
      slug: generateSlug(cat.name),
      description: cat.description,
      color: cat.color,
      isPopular: cat.isPopular
      };
    });
    const categories = await Category.insertMany(categoriesToInsert);
    console.log(`✓ Created ${categories.length} categories (with ALL 11 language translations: en, fr, es, de, it, pt, sv, fi, da, no, nl)`);

    // Seed authors (multilingual format)
    console.log('Seeding authors...');
    const authorTranslations = {
      'Sarah Johnson': {
        fr: { bio: 'Passionnée de technologie et ingénieure logicielle avec plus de 10 ans d\'expérience. Passionnée par le développement web et les technologies émergentes.' },
        es: { bio: 'Entusiasta de la tecnología e ingeniera de software con más de 10 años de experiencia. Apasionada por el desarrollo web y las tecnologías emergentes.' },
        de: { bio: 'Technikbegeisterte Softwareingenieurin mit über 10 Jahren Erfahrung. Leidenschaftlich für Webentwicklung und neue Technologien.' },
        it: { bio: 'Appassionata di tecnologia e ingegnere del software con oltre 10 anni di esperienza. Appassionata di sviluppo web e tecnologie emergenti.' },
        pt: { bio: 'Entusiasta de tecnologia e engenheira de software com mais de 10 anos de experiência. Apaixonada por desenvolvimento web e tecnologias emergentes.' },
        sv: { bio: 'Teknikentusiast och mjukvaruingenjör med över 10 års erfarenhet. Passionerad för webbutveckling och nya teknologier.' },
        fi: { bio: 'Teknologiaharrastaja ja ohjelmistosuunnittelija, jolla on yli 10 vuoden kokemus. Intoilija web-kehityksestä ja uusista teknologioista.' },
        da: { bio: 'Teknologieentusiast og softwareingeniør med over 10 års erfaring. Passioneret om webudvikling og nye teknologier.' },
        no: { bio: 'Teknologieentusiast og programvareingeniør med over 10 års erfaring. Lidenskapelig for webutvikling og nye teknologier.' },
        nl: { bio: 'Technologie-enthousiast en software-ingenieur met meer dan 10 jaar ervaring. Gepassioneerd over webontwikkeling en opkomende technologieën.' }
      },
      'Michael Chen': {
        fr: { bio: 'Designer UI/UX et directeur créatif. Spécialisé dans le design centré sur l\'utilisateur et les expériences numériques.' },
        es: { bio: 'Diseñador UI/UX y director creativo. Especializado en diseño centrado en el usuario y experiencias digitales.' },
        de: { bio: 'UI/UX-Designer und Kreativdirektor. Spezialisiert auf benutzerzentriertes Design und digitale Erfahrungen.' },
        it: { bio: 'Designer UI/UX e direttore creativo. Specializzato in design centrato sull\'utente ed esperienze digitali.' },
        pt: { bio: 'Designer UI/UX e diretor criativo. Especializado em design centrado no usuário e experiências digitais.' },
        sv: { bio: 'UI/UX-designer och kreativ direktör. Specialiserad på användarcentrerad design och digitala upplevelser.' },
        fi: { bio: 'UI/UX-suunnittelija ja luova johtaja. Erikoistunut käyttäjäkeskeiseen suunnitteluun ja digitaalisiin kokemuksiin.' },
        da: { bio: 'UI/UX-designer og kreativ direktør. Specialiseret i brugercentreret design og digitale oplevelser.' },
        no: { bio: 'UI/UX-designer og kreativ direktør. Spesialisert på brukerorientert design og digitale opplevelser.' },
        nl: { bio: 'UI/UX-ontwerper en creatief directeur. Gespecialiseerd in gebruikersgericht ontwerp en digitale ervaringen.' }
      },
      'Emily Rodriguez': {
        fr: { bio: 'Blogueuse lifestyle et coach bien-être. Partage des conseils pour un mode de vie équilibré et une croissance personnelle.' },
        es: { bio: 'Bloguera de estilo de vida y coach de bienestar. Compartiendo consejos para una vida equilibrada y crecimiento personal.' },
        de: { bio: 'Lifestyle-Bloggerin und Wellness-Coach. Teilt Tipps für ausgewogenes Leben und persönliches Wachstum.' },
        it: { bio: 'Blogger di lifestyle e coach del benessere. Condivide consigli per una vita equilibrata e crescita personale.' },
        pt: { bio: 'Blogueira de estilo de vida e coach de bem-estar. Compartilhando dicas para uma vida equilibrada e crescimento pessoal.' },
        sv: { bio: 'Lifestylbloggare och wellnesscoach. Delar tips för balanserat liv och personlig utveckling.' },
        fi: { bio: 'Elämäntapabloggaaja ja hyvinvointivalmentaja. Jakaa vinkkejä tasapainoiseen elämään ja henkilökohtaiseen kasvuun.' },
        da: { bio: 'Lifestylblogger og wellnesscoach. Deler tips til balanceret liv og personlig vækst.' },
        no: { bio: 'Lifestylblogger og wellnesscoach. Deler tips for balansert liv og personlig vekst.' },
        nl: { bio: 'Lifestyleblogger en wellnesscoach. Deelt tips voor een gebalanceerd leven en persoonlijke groei.' }
      },
      'David Kim': {
        fr: { bio: 'Stratège d\'affaires et entrepreneur. Aide les startups à se développer et à réussir.' },
        es: { bio: 'Estratega de negocios y emprendedor. Ayudando a las startups a escalar y tener éxito.' },
        de: { bio: 'Geschäftsstratege und Unternehmer. Hilft Startups beim Wachstum und Erfolg.' },
        it: { bio: 'Stratega aziendale e imprenditore. Aiuta le startup a crescere e avere successo.' },
        pt: { bio: 'Estrategista de negócios e empreendedor. Ajudando startups a escalar e ter sucesso.' },
        sv: { bio: 'Affärsstrateg och entreprenör. Hjälper startups att växa och lyckas.' },
        fi: { bio: 'Liiketoimintastrategi ja yrittäjä. Auttaa startupeja kasvamaan ja menestymään.' },
        da: { bio: 'Forretningsstrateg og iværksætter. Hjælper startups med at vokse og lykkes.' },
        no: { bio: 'Forretningsstrateg og gründer. Hjelper startups med å vokse og lykkes.' },
        nl: { bio: 'Bedrijfsstrateeg en ondernemer. Helpt startups groeien en slagen.' }
      },
      'Jessica Martinez': {
        fr: { bio: 'Écrivaine de voyage et photographe. Explorer le monde une destination à la fois.' },
        es: { bio: 'Escritora de viajes y fotógrafa. Explorando el mundo un destino a la vez.' },
        de: { bio: 'Reiseschriftstellerin und Fotografin. Erkundet die Welt ein Ziel nach dem anderen.' },
        it: { bio: 'Scrittrice di viaggi e fotografa. Esplorando il mondo una destinazione alla volta.' },
        pt: { bio: 'Escritora de viagens e fotógrafa. Explorando o mundo um destino de cada vez.' },
        sv: { bio: 'Reseskribent och fotograf. Utforskar världen en destination i taget.' },
        fi: { bio: 'Matkakirjoittaja ja valokuvaaja. Tutkimassa maailmaa yksi kohde kerrallaan.' },
        da: { bio: 'Rejseforfatter og fotograf. Udforsker verden ét rejsemål ad gangen.' },
        no: { bio: 'Reiseskribent og fotograf. Utforsker verden ett reisemål om gangen.' },
        nl: { bio: 'Reisschrijver en fotograaf. De wereld verkennen, één bestemming tegelijk.' }
      }
    };

    const authorsToInsert = authorsData.map(author => {
      const translations = {
        en: {
          slug: author.slug,
          bio: author.bio
        }
      };

      // Add translations for all supported languages
      SUPPORTED_LANGUAGES.forEach(lang => {
        if (lang !== 'en') {
          const authorTrans = authorTranslations[author.name]?.[lang];
          if (authorTrans) {
            translations[lang] = {
              slug: generateSlug(author.name), // Author name is not translated, so slug is based on name
              bio: authorTrans.bio
            };
          } else {
            // Fallback
            translations[lang] = {
              slug: generateSlug(author.name),
              bio: `${author.bio} (Translated to ${lang.toUpperCase()})`
            };
          }
        }
      });

      return {
        baseSlug: author.slug,
        defaultLanguage: 'en',
        name: author.name,
        translations,
        // Legacy fields for backward compatibility
        slug: author.slug,
        bio: author.bio,
        email: author.email,
        socialLinks: author.socialLinks
      };
    });
    const authors = await Author.insertMany(authorsToInsert);
    console.log(`✓ Created ${authors.length} authors (with ALL ${SUPPORTED_LANGUAGES.length} language translations: ${SUPPORTED_LANGUAGES.join(', ')})`);

    // Seed articles
    console.log('Seeding articles...');
    const articles = [];
    
    // Map articles to categories and authors
    const categoryMap = {
      'Technology': categories.find(c => c.translations?.en?.name === 'Technology'),
      'Design': categories.find(c => c.translations?.en?.name === 'Design'),
      'Lifestyle': categories.find(c => c.translations?.en?.name === 'Lifestyle'),
      'Business': categories.find(c => c.translations?.en?.name === 'Business'),
      'Wellness': categories.find(c => c.translations?.en?.name === 'Wellness'),
      'Travel': categories.find(c => c.translations?.en?.name === 'Travel')
    };

    const authorMap = {
      'Sarah Johnson': authors.find(a => a.name === 'Sarah Johnson'),
      'Michael Chen': authors.find(a => a.name === 'Michael Chen'),
      'Emily Rodriguez': authors.find(a => a.name === 'Emily Rodriguez'),
      'David Kim': authors.find(a => a.name === 'David Kim'),
      'Jessica Martinez': authors.find(a => a.name === 'Jessica Martinez')
    };

    // Assign articles to categories and authors
    const articleAssignments = [
      { category: 'Lifestyle', author: 'Emily Rodriguez' },
      { category: 'Technology', author: 'Sarah Johnson' },
      { category: 'Design', author: 'Michael Chen' },
      { category: 'Business', author: 'David Kim' },
      { category: 'Travel', author: 'Jessica Martinez' },
      { category: 'Wellness', author: 'Emily Rodriguez' },
      { category: 'Lifestyle', author: 'Emily Rodriguez' },
      { category: 'Business', author: 'David Kim' },
      { category: 'Business', author: 'David Kim' },
      { category: 'Design', author: 'Michael Chen' }
    ];

    for (let i = 0; i < articlesData.length; i++) {
      const articleData = articlesData[i];
      const assignment = articleAssignments[i];
      
      // Generate slug from title
      const slug = generateSlug(articleData.title);
      const baseSlug = slug;
      
      // Convert content array to string if needed
      const contentString = Array.isArray(articleData.content) 
        ? articleData.content.join('\n\n') 
        : articleData.content;
      
      // Create article in multilingual format
      // Add French and Spanish translations for first 3 articles as examples
      const translations = {
          en: {
            title: articleData.title,
            slug: slug,
            excerpt: articleData.excerpt,
          content: Array.isArray(articleData.content) ? articleData.content : [contentString],
          metaTitle: articleData.title.length > 60 ? articleData.title.substring(0, 57) + '...' : articleData.title,
          metaDescription: articleData.excerpt.length > 160 ? articleData.excerpt.substring(0, 157) + '...' : articleData.excerpt,
          keywords: articleData.tags || []
        }
      };

      // Add sample translations for first 3 articles in ALL 11 languages
      if (i < 3) {
        // Article 0: Morning Routines
        const article0Translations = {
          fr: { title: 'Créer des routines matinales qui fonctionnent vraiment', excerpt: 'Découvrez les stratégies fondées sur la science pour créer des routines matinales qui transforment votre productivité et votre bien-être.', metaTitle: 'Routines matinales efficaces | Guide' },
          es: { title: 'Construir rutinas matutinas que realmente funcionan', excerpt: 'Descubre las estrategias respaldadas por la ciencia para crear rutinas matutinas que transforman tu productividad y bienestar.', metaTitle: 'Rutinas matutinas efectivas | Guía' },
          de: { title: 'Morgenroutinen schaffen, die wirklich funktionieren', excerpt: 'Entdecken Sie wissenschaftlich fundierte Strategien zur Schaffung von Morgenroutinen, die Ihre Produktivität und Ihr Wohlbefinden transformieren.', metaTitle: 'Effektive Morgenroutinen | Leitfaden' },
          it: { title: 'Creare routine mattutine che funzionano davvero', excerpt: 'Scopri le strategie basate sulla scienza per creare routine mattutine che trasformano la tua produttività e benessere.', metaTitle: 'Routine mattutine efficaci | Guida' },
          pt: { title: 'Criar rotinas matinais que realmente funcionam', excerpt: 'Descubra estratégias baseadas em ciência para criar rotinas matinais que transformam sua produtividade e bem-estar.', metaTitle: 'Rotinas matinais eficazes | Guia' },
          sv: { title: 'Skapa morgonrutiner som verkligen fungerar', excerpt: 'Upptäck vetenskapsbaserade strategier för att skapa morgonrutiner som förvandlar din produktivitet och välmående.', metaTitle: 'Effektiva morgonrutiner | Guide' },
          fi: { title: 'Luoda aamurutiineja, jotka todella toimivat', excerpt: 'Löydä tieteeseen perustuvia strategioita aamurutiinien luomiseen, jotka muuttavat tuottavuutesi ja hyvinvointisi.', metaTitle: 'Tehokkaat aamurutiinit | Opas' },
          da: { title: 'Opret morgenrutiner der virkelig virker', excerpt: 'Opdag videnskabsbaserede strategier til at skabe morgenrutiner, der transformerer din produktivitet og velvære.', metaTitle: 'Effektive morgenrutiner | Guide' },
          no: { title: 'Skape morgenrutiner som virkelig fungerer', excerpt: 'Oppdag vitenskapsbaserte strategier for å skape morgenrutiner som transformerer din produktivitet og velvære.', metaTitle: 'Effektive morgenrutiner | Guide' },
          nl: { title: 'Ochtendroutines creëren die echt werken', excerpt: 'Ontdek wetenschappelijk onderbouwde strategieën voor het creëren van ochtendroutines die uw productiviteit en welzijn transformeren.', metaTitle: 'Effectieve ochtendroutines | Gids' }
        };
        
        // Article 1: Web Development Trends
        const article1Translations = {
          fr: { title: 'L\'avenir du développement web : Tendances 2024', excerpt: 'Explorez les dernières tendances qui façonnent le développement web, de l\'intégration de l\'IA aux nouveaux frameworks et outils.', metaTitle: 'Développement web 2024 | Tendances' },
          es: { title: 'El futuro del desarrollo web: Tendencias 2024', excerpt: 'Explora las últimas tendencias que dan forma al desarrollo web, desde la integración de IA hasta nuevos frameworks y herramientas.', metaTitle: 'Desarrollo web 2024 | Tendencias' },
          de: { title: 'Die Zukunft der Webentwicklung: Trends 2024', excerpt: 'Erkunden Sie die neuesten Trends, die die Webentwicklung prägen, von KI-Integration bis hin zu neuen Frameworks und Tools.', metaTitle: 'Webentwicklung 2024 | Trends' },
          it: { title: 'Il futuro dello sviluppo web: Tendenze 2024', excerpt: 'Esplora le ultime tendenze che modellano lo sviluppo web, dall\'integrazione dell\'IA ai nuovi framework e strumenti.', metaTitle: 'Sviluppo web 2024 | Tendenze' },
          pt: { title: 'O futuro do desenvolvimento web: Tendências 2024', excerpt: 'Explore as últimas tendências que moldam o desenvolvimento web, da integração de IA a novos frameworks e ferramentas.', metaTitle: 'Desenvolvimento web 2024 | Tendências' },
          sv: { title: 'Webbutvecklingens framtid: Trender 2024', excerpt: 'Utforska de senaste trenderna som formar webbutvecklingen, från AI-integration till nya ramverk och verktyg.', metaTitle: 'Webbutveckling 2024 | Trender' },
          fi: { title: 'Web-kehityksen tulevaisuus: Trendit 2024', excerpt: 'Tutustu uusimpiin trendeihin, jotka muokkaavat web-kehitystä, tekoälyintegraatiosta uusiin kehyksiin ja työkaluihin.', metaTitle: 'Web-kehitys 2024 | Trendit' },
          da: { title: 'Webudviklingens fremtid: Tendenser 2024', excerpt: 'Udforsk de seneste tendenser, der former webudviklingen, fra AI-integration til nye frameworks og værktøjer.', metaTitle: 'Webudvikling 2024 | Tendenser' },
          no: { title: 'Webutviklingens fremtid: Trender 2024', excerpt: 'Utforsk de nyeste trendene som former webutviklingen, fra AI-integrasjon til nye rammeverk og verktøy.', metaTitle: 'Webutvikling 2024 | Trender' },
          nl: { title: 'De toekomst van webontwikkeling: Trends 2024', excerpt: 'Verken de nieuwste trends die webontwikkeling vormgeven, van AI-integratie tot nieuwe frameworks en tools.', metaTitle: 'Webontwikkeling 2024 | Trends' }
        };
        
        // Article 2: Design Systems
        const article2Translations = {
          fr: { title: 'Systèmes de design : Cohérence à grande échelle', excerpt: 'Découvrez comment les systèmes de design aident les équipes à créer des expériences utilisateur cohérentes sur les produits et les plateformes.', metaTitle: 'Systèmes de design | Cohérence' },
          es: { title: 'Sistemas de diseño: Consistencia a escala', excerpt: 'Aprende cómo los sistemas de diseño ayudan a los equipos a crear experiencias de usuario cohesivas en productos y plataformas.', metaTitle: 'Sistemas de diseño | Consistencia' },
          de: { title: 'Designsysteme: Konsistenz im großen Maßstab', excerpt: 'Erfahren Sie, wie Designsysteme Teams dabei helfen, konsistente Benutzererfahrungen über Produkte und Plattformen hinweg zu schaffen.', metaTitle: 'Designsysteme | Konsistenz' },
          it: { title: 'Sistemi di design: Coerenza su larga scala', excerpt: 'Scopri come i sistemi di design aiutano i team a creare esperienze utente coerenti su prodotti e piattaforme.', metaTitle: 'Sistemi di design | Coerenza' },
          pt: { title: 'Sistemas de design: Consistência em escala', excerpt: 'Aprenda como os sistemas de design ajudam as equipes a criar experiências de usuário coesas em produtos e plataformas.', metaTitle: 'Sistemas de design | Consistência' },
          sv: { title: 'Designsystem: Konsistens i stor skala', excerpt: 'Lär dig hur designsystem hjälper team att skapa sammanhängande användarupplevelser över produkter och plattformar.', metaTitle: 'Designsystem | Konsistens' },
          fi: { title: 'Suunnittelujärjestelmät: Yhdenmukaisuus laajassa mittakaavassa', excerpt: 'Opi, miten suunnittelujärjestelmät auttavat tiimejä luomaan johdonmukaisia käyttökokemuksia tuotteissa ja alustoissa.', metaTitle: 'Suunnittelujärjestelmät | Yhdenmukaisuus' },
          da: { title: 'Designsystemer: Konsistens i stor skala', excerpt: 'Lær, hvordan designsystemer hjælper teams med at skabe sammenhængende brugeroplevelser på tværs af produkter og platforme.', metaTitle: 'Designsystemer | Konsistens' },
          no: { title: 'Designsystemer: Konsistens i stor skala', excerpt: 'Lær hvordan designsystemer hjelper team med å skape sammenhengende brukeropplevelser på tvers av produkter og plattformer.', metaTitle: 'Designsystemer | Konsistens' },
          nl: { title: 'Ontwerpsystemen: Consistentie op grote schaal', excerpt: 'Leer hoe ontwerpsystemen teams helpen consistente gebruikerservaringen te creëren over producten en platforms heen.', metaTitle: 'Ontwerpsystemen | Consistentie' }
        };
        
        const articleTranslations = [article0Translations, article1Translations, article2Translations];
        const currentTranslations = articleTranslations[i];
        
        // Add all 11 language translations
        const supportedLanguages = ['fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'];
        supportedLanguages.forEach(lang => {
          if (currentTranslations[lang]) {
            translations[lang] = {
              title: currentTranslations[lang].title,
              slug: generateSlug(currentTranslations[lang].title),
              excerpt: currentTranslations[lang].excerpt,
              content: Array.isArray(articleData.content) ? articleData.content : [contentString], // Keep same content for demo
              metaTitle: currentTranslations[lang].metaTitle,
              metaDescription: currentTranslations[lang].excerpt.substring(0, 160), // Max 160 chars
              keywords: articleData.tags || []
            };
          }
        });
      } else {
        // Add translations for remaining articles (3-9) in all languages
        const remainingArticleTranslations = {
          3: { // Remote Work
            fr: { title: 'Télétravail : Construire une culture à distance', excerpt: 'Stratégies pour maintenir la culture d\'équipe et la collaboration dans les environnements de travail à distance et hybrides.', metaTitle: 'Télétravail | Culture d\'équipe' },
            es: { title: 'Trabajo remoto: Construir cultura a distancia', excerpt: 'Estrategias para mantener la cultura del equipo y la colaboración en entornos de trabajo remoto e híbrido.', metaTitle: 'Trabajo remoto | Cultura' },
            de: { title: 'Remote-Arbeit: Kultur über Distanzen aufbauen', excerpt: 'Strategien zur Aufrechterhaltung der Teamkultur und Zusammenarbeit in Remote- und Hybrid-Arbeitsumgebungen.', metaTitle: 'Remote-Arbeit | Teamkultur' },
            it: { title: 'Lavoro remoto: Costruire cultura a distanza', excerpt: 'Strategie per mantenere la cultura del team e la collaborazione in ambienti di lavoro remoti e ibridi.', metaTitle: 'Lavoro remoto | Cultura' },
            pt: { title: 'Trabalho remoto: Construindo cultura à distância', excerpt: 'Estratégias para manter a cultura da equipe e a colaboração em ambientes de trabalho remoto e híbrido.', metaTitle: 'Trabalho remoto | Cultura' },
            sv: { title: 'Distansarbete: Bygga kultur över avstånd', excerpt: 'Strategier för att upprätthålla teamkultur och samarbete i distans- och hybridarbetsmiljöer.', metaTitle: 'Distansarbete | Teamkultur' },
            fi: { title: 'Etätyö: Kulttuurin rakentaminen etäisyyden yli', excerpt: 'Strategioita tiimikulttuurin ja yhteistyön ylläpitämiseksi etä- ja hybridityöympäristöissä.', metaTitle: 'Etätyö | Tiimikulttuuri' },
            da: { title: 'Fjernarbejde: Bygge kultur på tværs af afstande', excerpt: 'Strategier til at opretholde teamkultur og samarbejde i fjern- og hybridarbejdsmiljøer.', metaTitle: 'Fjernarbejde | Teamkultur' },
            no: { title: 'Fjernarbeid: Bygge kultur på tvers av avstander', excerpt: 'Strategier for å opprettholde teamkultur og samarbeid i fjern- og hybridarbeidsmiljøer.', metaTitle: 'Fjernarbeid | Teamkultur' },
            nl: { title: 'Remote werken: Cultuur opbouwen over afstanden', excerpt: 'Strategieën voor het behouden van teamcultuur en samenwerking in remote en hybride werkomgevingen.', metaTitle: 'Remote werken | Teamcultuur' }
          },
          4: { // Sustainable Travel
            fr: { title: 'Voyage durable : Explorer le monde responsablement', excerpt: 'Comment voyager de manière à respecter les communautés locales et minimiser l\'impact environnemental.', metaTitle: 'Voyage durable | Responsabilité' },
            es: { title: 'Viaje sostenible: Explorar el mundo responsablemente', excerpt: 'Cómo viajar de manera que respete las comunidades locales y minimice el impacto ambiental.', metaTitle: 'Viaje sostenible | Responsabilidad' },
            de: { title: 'Nachhaltiges Reisen: Die Welt verantwortungsvoll erkunden', excerpt: 'Wie man auf eine Weise reist, die lokale Gemeinschaften respektiert und die Umweltauswirkungen minimiert.', metaTitle: 'Nachhaltiges Reisen | Verantwortung' },
            it: { title: 'Viaggio sostenibile: Esplorare il mondo responsabilmente', excerpt: 'Come viaggiare in modo da rispettare le comunità locali e minimizzare l\'impatto ambientale.', metaTitle: 'Viaggio sostenibile | Responsabilità' },
            pt: { title: 'Viagem sustentável: Explorar o mundo com responsabilidade', excerpt: 'Como viajar de forma a respeitar as comunidades locais e minimizar o impacto ambiental.', metaTitle: 'Viagem sustentável | Responsabilidade' },
            sv: { title: 'Hållbart resande: Utforska världen ansvarsfullt', excerpt: 'Hur man reser på ett sätt som respekterar lokala samhällen och minimerar miljöpåverkan.', metaTitle: 'Hållbart resande | Ansvar' },
            fi: { title: 'Kestävää matkailua: Maailman tutkiminen vastuullisesti', excerpt: 'Kuinka matkustaa tavalla, joka kunnioittaa paikallisia yhteisöjä ja minimoi ympäristövaikutukset.', metaTitle: 'Kestävää matkailua | Vastuu' },
            da: { title: 'Bæredygtig rejse: Udforske verden ansvarligt', excerpt: 'Hvordan man rejser på en måde, der respekterer lokale samfund og minimerer miljøpåvirkning.', metaTitle: 'Bæredygtig rejse | Ansvar' },
            no: { title: 'Bærekraftig reise: Utforske verden ansvarlig', excerpt: 'Hvordan reise på en måte som respekterer lokale samfunn og minimerer miljøpåvirkning.', metaTitle: 'Bærekraftig reise | Ansvar' },
            nl: { title: 'Duurzaam reizen: De wereld verantwoord verkennen', excerpt: 'Hoe te reizen op een manier die lokale gemeenschappen respecteert en de milieueffecten minimaliseert.', metaTitle: 'Duurzaam reizen | Verantwoordelijkheid' }
          },
          5: { // Mindfulness
            fr: { title: 'Pleine conscience à l\'ère numérique', excerpt: 'Techniques pratiques pour rester présent et réduire la surcharge numérique dans notre monde connecté.', metaTitle: 'Pleine conscience | Numérique' },
            es: { title: 'Mindfulness en la era digital', excerpt: 'Técnicas prácticas para mantenerse presente y reducir la sobrecarga digital en nuestro mundo conectado.', metaTitle: 'Mindfulness | Era digital' },
            de: { title: 'Achtsamkeit im digitalen Zeitalter', excerpt: 'Praktische Techniken, um präsent zu bleiben und digitale Überforderung in unserer vernetzten Welt zu reduzieren.', metaTitle: 'Achtsamkeit | Digital' },
            it: { title: 'Mindfulness nell\'era digitale', excerpt: 'Tecniche pratiche per rimanere presenti e ridurre il sovraccarico digitale nel nostro mondo connesso.', metaTitle: 'Mindfulness | Era digitale' },
            pt: { title: 'Mindfulness na era digital', excerpt: 'Técnicas práticas para permanecer presente e reduzir a sobrecarga digital em nosso mundo conectado.', metaTitle: 'Mindfulness | Era digital' },
            sv: { title: 'Medveten närvaro i den digitala eran', excerpt: 'Praktiska tekniker för att stanna närvarande och minska digital överbelastning i vår uppkopplade värld.', metaTitle: 'Medveten närvaro | Digital' },
            fi: { title: 'Tietoisuus digiaikakaudella', excerpt: 'Käytännöllisiä tekniikoita pysyä läsnä ja vähentää digitaalista ylikuormitusta yhdistetyssä maailmassamme.', metaTitle: 'Tietoisuus | Digitaalinen' },
            da: { title: 'Bevidsthed i det digitale tidsalder', excerpt: 'Praktiske teknikker til at forblive til stede og reducere digital overbelastning i vores forbundne verden.', metaTitle: 'Bevidsthed | Digital' },
            no: { title: 'Bevissthet i den digitale tidsalder', excerpt: 'Praktiske teknikker for å forbli til stede og redusere digital overbelastning i vår tilkoblede verden.', metaTitle: 'Bevissthet | Digital' },
            nl: { title: 'Mindfulness in het digitale tijdperk', excerpt: 'Praktische technieken om aanwezig te blijven en digitale overbelasting te verminderen in onze verbonden wereld.', metaTitle: 'Mindfulness | Digitaal' }
          },
          6: { // Minimalist Living
            fr: { title: 'L\'art de vivre minimaliste', excerpt: 'Découvrez comment moins peut être plus lorsqu\'il s\'agit de créer une vie significative et intentionnelle.', metaTitle: 'Vie minimaliste | Art de vivre' },
            es: { title: 'El arte de vivir minimalista', excerpt: 'Descubre cómo menos puede ser más cuando se trata de crear una vida significativa e intencional.', metaTitle: 'Vida minimalista | Arte' },
            de: { title: 'Die Kunst des minimalistischen Lebens', excerpt: 'Entdecken Sie, wie weniger mehr sein kann, wenn es darum geht, ein bedeutungsvolles und bewusstes Leben zu schaffen.', metaTitle: 'Minimalistisches Leben | Kunst' },
            it: { title: 'L\'arte della vita minimalista', excerpt: 'Scopri come meno può essere di più quando si tratta di creare una vita significativa e intenzionale.', metaTitle: 'Vita minimalista | Arte' },
            pt: { title: 'A arte de viver minimalista', excerpt: 'Descubra como menos pode ser mais quando se trata de criar uma vida significativa e intencional.', metaTitle: 'Vida minimalista | Arte' },
            sv: { title: 'Konsten att leva minimalistiskt', excerpt: 'Upptäck hur mindre kan vara mer när det gäller att skapa ett meningsfullt och avsiktligt liv.', metaTitle: 'Minimalistiskt liv | Konst' },
            fi: { title: 'Minimalistisen elämän taito', excerpt: 'Opi, miten vähemmän voi olla enemmän, kun kyse on merkityksellisen ja tarkoituksenmukaisen elämän luomisesta.', metaTitle: 'Minimalistinen elämä | Taito' },
            da: { title: 'Kunsten at leve minimalistisk', excerpt: 'Opdag, hvordan mindre kan være mere, når det handler om at skabe et meningsfuldt og bevidst liv.', metaTitle: 'Minimalistisk liv | Kunst' },
            no: { title: 'Kunsten å leve minimalistisk', excerpt: 'Oppdag hvordan mindre kan være mer når det gjelder å skape et meningsfullt og bevisst liv.', metaTitle: 'Minimalistisk liv | Kunst' },
            nl: { title: 'De kunst van minimalistisch leven', excerpt: 'Ontdek hoe minder meer kan zijn als het gaat om het creëren van een betekenisvol en bewust leven.', metaTitle: 'Minimalistisch leven | Kunst' }
          },
          7: { // Personal Brand
            fr: { title: 'Construire votre marque personnelle en 2024', excerpt: 'Stratégies pour créer une marque personnelle authentique et convaincante qui ouvre des portes.', metaTitle: 'Marque personnelle 2024 | Stratégies' },
            es: { title: 'Construir tu marca personal en 2024', excerpt: 'Estrategias para crear una marca personal auténtica y convincente que abra puertas.', metaTitle: 'Marca personal 2024 | Estrategias' },
            de: { title: 'Ihre persönliche Marke in 2024 aufbauen', excerpt: 'Strategien zur Schaffung einer authentischen und überzeugenden persönlichen Marke, die Türen öffnet.', metaTitle: 'Persönliche Marke 2024 | Strategien' },
            it: { title: 'Costruire il tuo brand personale nel 2024', excerpt: 'Strategie per creare un brand personale autentico e convincente che apra porte.', metaTitle: 'Brand personale 2024 | Strategie' },
            pt: { title: 'Construindo sua marca pessoal em 2024', excerpt: 'Estratégias para criar uma marca pessoal autêntica e convincente que abra portas.', metaTitle: 'Marca pessoal 2024 | Estratégias' },
            sv: { title: 'Bygga ditt personliga varumärke 2024', excerpt: 'Strategier för att skapa ett autentiskt och övertygande personligt varumärke som öppnar dörrar.', metaTitle: 'Personligt varumärke 2024 | Strategier' },
            fi: { title: 'Henkilökohtaisen brändin rakentaminen 2024', excerpt: 'Strategioita aidon ja vakuuttavan henkilökohtaisen brändin luomiseen, joka avaa ovia.', metaTitle: 'Henkilökohtainen brändi 2024 | Strategiat' },
            da: { title: 'Bygge dit personlige brand i 2024', excerpt: 'Strategier til at skabe et autentisk og overbevisende personligt brand, der åbner døre.', metaTitle: 'Personligt brand 2024 | Strategier' },
            no: { title: 'Bygge ditt personlige merke i 2024', excerpt: 'Strategier for å skape et autentisk og overbevisende personlig merke som åpner dører.', metaTitle: 'Personlig merke 2024 | Strategier' },
            nl: { title: 'Je persoonlijke merk opbouwen in 2024', excerpt: 'Strategieën voor het creëren van een authentiek en overtuigend persoonlijk merk dat deuren opent.', metaTitle: 'Persoonlijk merk 2024 | Strategieën' }
          },
          8: { // Productivity
            fr: { title: 'La science de la productivité : Ce qui fonctionne vraiment', excerpt: 'Stratégies fondées sur des preuves pour en faire plus sans s\'épuiser.', metaTitle: 'Productivité | Science' },
            es: { title: 'La ciencia de la productividad: Lo que realmente funciona', excerpt: 'Estrategias basadas en evidencia para hacer más sin agotarse.', metaTitle: 'Productividad | Ciencia' },
            de: { title: 'Die Wissenschaft der Produktivität: Was wirklich funktioniert', excerpt: 'Evidenzbasierte Strategien, um mehr zu erreichen, ohne sich zu erschöpfen.', metaTitle: 'Produktivität | Wissenschaft' },
            it: { title: 'La scienza della produttività: Cosa funziona davvero', excerpt: 'Strategie basate su prove per fare di più senza esaurirsi.', metaTitle: 'Produttività | Scienza' },
            pt: { title: 'A ciência da produtividade: O que realmente funciona', excerpt: 'Estratégias baseadas em evidências para fazer mais sem se esgotar.', metaTitle: 'Produtividade | Ciência' },
            sv: { title: 'Produktivitetsvetenskapen: Vad som verkligen fungerar', excerpt: 'Evidensbaserade strategier för att få mer gjort utan att bli utmattad.', metaTitle: 'Produktivitet | Vetenskap' },
            fi: { title: 'Tuottavuustiede: Mikä todella toimii', excerpt: 'Todistusperusteiset strategiat saada enemmän aikaan ilman uupumusta.', metaTitle: 'Tuottavuus | Tiede' },
            da: { title: 'Produktivitetsvidenskaben: Hvad der virkelig virker', excerpt: 'Evidensbaserede strategier til at få mere gjort uden at blive udmattet.', metaTitle: 'Produktivitet | Videnskab' },
            no: { title: 'Produktivitetsvitenskapen: Hva som virkelig fungerer', excerpt: 'Evidensbaserte strategier for å få mer gjort uten å bli utmattet.', metaTitle: 'Produktivitet | Vitenskap' },
            nl: { title: 'De wetenschap van productiviteit: Wat echt werkt', excerpt: 'Evidence-based strategieën om meer gedaan te krijgen zonder uitgeput te raken.', metaTitle: 'Productiviteit | Wetenschap' }
          },
          9: { // UX Design
            fr: { title: 'Design d\'expérience utilisateur : Au-delà de l\'interface', excerpt: 'Comprendre comment une excellente UX s\'étend au-delà des écrans pour créer des expériences humaines significatives.', metaTitle: 'UX Design | Au-delà interface' },
            es: { title: 'Diseño de experiencia de usuario: Más allá de la interfaz', excerpt: 'Comprender cómo una gran UX se extiende más allá de las pantallas para crear experiencias humanas significativas.', metaTitle: 'Diseño UX | Más allá interfaz' },
            de: { title: 'User Experience Design: Jenseits der Benutzeroberfläche', excerpt: 'Verstehen, wie großartige UX über Bildschirme hinausgeht, um bedeutungsvolle menschliche Erfahrungen zu schaffen.', metaTitle: 'UX-Design | Jenseits UI' },
            it: { title: 'Design dell\'esperienza utente: Oltre l\'interfaccia', excerpt: 'Comprendere come una grande UX si estende oltre gli schermi per creare esperienze umane significative.', metaTitle: 'Design UX | Oltre interfaccia' },
            pt: { title: 'Design de experiência do usuário: Além da interface', excerpt: 'Entender como uma ótima UX se estende além das telas para criar experiências humanas significativas.', metaTitle: 'Design UX | Além interface' },
            sv: { title: 'Användarupplevelsedesign: Bortom gränssnittet', excerpt: 'Förstå hur stor UX sträcker sig bortom skärmar för att skapa meningsfulla mänskliga upplevelser.', metaTitle: 'UX-design | Bortom UI' },
            fi: { title: 'Käyttökokemuksen suunnittelu: Käyttöliittymän ulkopuolella', excerpt: 'Ymmärrä, miten loistava UX ulottuu näyttöjen ulkopuolelle luomaan merkityksellisiä inhimillisiä kokemuksia.', metaTitle: 'UX-suunnittelu | UI:n ulkopuolella' },
            da: { title: 'Brugeroplevelsesdesign: Uden for grænsefladen', excerpt: 'Forstå, hvordan stor UX strækker sig ud over skærme for at skabe meningsfulde menneskelige oplevelser.', metaTitle: 'UX-design | Uden for UI' },
            no: { title: 'Brukeropplevelsesdesign: Utenfor grensesnittet', excerpt: 'Forstå hvordan stor UX strekker seg utover skjermer for å skape meningsfulle menneskelige opplevelser.', metaTitle: 'UX-design | Utenfor UI' },
            nl: { title: 'Gebruikerservaringsontwerp: Voorbij de interface', excerpt: 'Begrijp hoe geweldige UX zich uitstrekt voorbij schermen om betekenisvolle menselijke ervaringen te creëren.', metaTitle: 'UX-ontwerp | Voorbij UI' }
          }
        };

        const currentTranslations = remainingArticleTranslations[i];
        if (currentTranslations) {
          const supportedLanguages = ['fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'];
          supportedLanguages.forEach(lang => {
            if (currentTranslations[lang]) {
              translations[lang] = {
                title: currentTranslations[lang].title,
                slug: generateSlug(currentTranslations[lang].title),
                excerpt: currentTranslations[lang].excerpt,
                content: Array.isArray(articleData.content) ? articleData.content : [contentString],
                metaTitle: currentTranslations[lang].metaTitle,
                metaDescription: currentTranslations[lang].excerpt.substring(0, 160),
                keywords: articleData.tags || []
              };
            }
          });
        }
      }

      const article = await Article.create({
        baseSlug,
        defaultLanguage: 'en',
        translations,
        // Legacy fields for backward compatibility
        title: articleData.title,
        slug: slug,
        excerpt: articleData.excerpt,
        content: contentString,
        imageUrl: articleData.imageUrl,
        tags: articleData.tags,
        category: categoryMap[assignment.category]._id,
        author: authorMap[assignment.author]._id,
        published: articleData.published,
        featured: articleData.featured || false,
        trending: articleData.trending || false,
        isGlobal: true, // All seeded articles are global by default
        regionRestrictions: []
      });
      
      articles.push(article);
    }

    console.log(`✓ Created ${articles.length} articles`);

    // Update category and author counts
    console.log('Updating counts...');
    for (const category of categories) {
      await category.updatePostCount();
    }
    for (const author of authors) {
      await author.updateArticleCount();
    }
    console.log('✓ Updated counts');

    // Seed admin user (if not already present)
    console.log('Seeding admin user...');
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@blogify.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';

    const existingAdmin = await User.findOne({ email: adminEmail });
    if (!existingAdmin) {
      const adminUser = await User.create({
        username: 'admin',
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        emailVerified: true,
      });
      console.log(`✓ Created admin user: ${adminUser.email} (password: ${adminPassword})`);
    } else {
      console.log(`✓ Admin user already exists: ${existingAdmin.email}`);
    }

    console.log('\n✅ Database seeded successfully!');
    console.log(`\nSummary:`);
    console.log(`- Regions: ${await Region.countDocuments()}`);
    console.log(`- Categories: ${categories.length} (with ALL ${SUPPORTED_LANGUAGES.length} language translations: ${SUPPORTED_LANGUAGES.join(', ')})`);
    console.log(`- Authors: ${authors.length} (with ALL ${SUPPORTED_LANGUAGES.length} language translations: ${SUPPORTED_LANGUAGES.join(', ')})`);
    console.log(`- Articles: ${articles.length} (with ALL ${SUPPORTED_LANGUAGES.length} language translations: ${SUPPORTED_LANGUAGES.join(', ')})`);
    console.log(`- Admin user: ${adminEmail}`);
    console.log(`\nNote: Run 'npm run seed:regions' separately if you need to reset regions.`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

// Run seed
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };


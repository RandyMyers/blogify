const formatPopulatedAuthor = (author, language) => {
  if (!author) return null;
  if (typeof author === 'string') return null;
  const base = author.toObject ? author.toObject() : { ...author };
  if (!base.name && !base._id) return null;
  let slug = base.slug || base.baseSlug;
  if (typeof author.getTranslation === 'function') {
    const tr = author.getTranslation(language);
    if (tr?.slug) slug = tr.slug;
  }
  return {
    _id: base._id,
    name: base.name || 'Author',
    slug,
    avatar: base.avatar,
  };
};

const formatPopulatedCategory = (category, language) => {
  if (!category) return null;
  if (typeof category === 'string') return null;
  const base = category.toObject ? category.toObject() : { ...category };
  let slug = base.slug || base.baseSlug;
  let name = base.name;
  let description = base.description;
  if (typeof category.getTranslation === 'function') {
    const tr = category.getTranslation(language);
    if (tr) {
      if (tr.slug) slug = tr.slug;
      if (tr.name) name = tr.name;
      if (tr.description) description = tr.description;
    }
  }
  return {
    _id: base._id,
    name: name || 'Category',
    slug,
    color: base.color,
    description,
  };
};

const transformArticleForPublic = (article, language) => {
  const translation = article.getTranslation(language);
  const defaultTranslation = article.getTranslation(article.defaultLanguage);
  const activeTranslation = translation || defaultTranslation;

  if (!activeTranslation) {
    return null;
  }

  return {
    _id: article._id,
    baseSlug: article.baseSlug,
    slug: activeTranslation.slug,
    title: activeTranslation.title,
    excerpt: activeTranslation.excerpt,
    content: activeTranslation.content,
    imageUrl: article.imageUrl,
    imageAlt: article.imageAlt || '',
    category: formatPopulatedCategory(article.category, language),
    author: formatPopulatedAuthor(article.author, language),
    tags: article.tags,
    publishedAt: article.publishedAt,
    views: article.views,
    likes: article.likes,
    readTime: article.readTime,
    commentCount: article.commentCount || 0,
    featured: article.featured,
    trending: article.trending,
    language,
  };
};

module.exports = {
  formatPopulatedAuthor,
  formatPopulatedCategory,
  transformArticleForPublic,
};

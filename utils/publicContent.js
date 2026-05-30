const formatPopulatedAuthor = (author, language) => {
  if (!author) return null;
  const base = author.toObject ? author.toObject() : { ...author };
  let slug = base.slug || base.baseSlug;
  if (typeof author.getTranslation === 'function') {
    const tr = author.getTranslation(language);
    if (tr?.slug) slug = tr.slug;
  }
  return {
    _id: base._id,
    name: base.name,
    slug,
    avatar: base.avatar,
  };
};

const transformArticleForPublic = (article, language) => {
  const translation = article.getTranslation(language);
  const defaultTranslation = article.getTranslation(article.defaultLanguage);
  const activeTranslation = translation || defaultTranslation;

  if (!activeTranslation) {
    return null;
  }

  let categoryData = article.category;
  if (article.category && article.category.getTranslation) {
    const categoryTranslation = article.category.getTranslation(language);
    if (categoryTranslation) {
      categoryData = {
        ...article.category.toObject(),
        name: categoryTranslation.name || article.category.name,
        slug: categoryTranslation.slug || article.category.slug,
        description: categoryTranslation.description || article.category.description,
      };
    }
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
    category: categoryData,
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
  transformArticleForPublic,
};

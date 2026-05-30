const Comment = require('../models/Comment');
const Article = require('../models/Article');

async function syncCommentCount(articleId) {
  if (!articleId) return;
  const count = await Comment.countDocuments({
    articleId,
    status: 'approved',
  });
  await Article.updateOne({ _id: articleId }, { $set: { commentCount: count } });
  return count;
}

module.exports = { syncCommentCount };

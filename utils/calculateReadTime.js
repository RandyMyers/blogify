/**
 * Calculate reading time based on content
 * Average reading speed: 200-250 words per minute
 * @param {string|Array} content - Article content (string or array of paragraphs)
 * @returns {string} - Formatted reading time (e.g., "5 min read")
 */
const calculateReadTime = (content) => {
  let text = '';
  
  // Handle array of paragraphs or single string
  if (Array.isArray(content)) {
    text = content.join(' ');
  } else if (typeof content === 'string') {
    text = content;
  } else {
    return '1 min read';
  }
  
  // Count words (split by whitespace and filter empty strings)
  const words = text.trim().split(/\s+/).filter(word => word.length > 0);
  const wordCount = words.length;
  
  // Average reading speed: 225 words per minute
  const wordsPerMinute = 225;
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  
  // Minimum 1 minute
  const readingTime = Math.max(1, minutes);
  
  return `${readingTime} min read`;
};

module.exports = calculateReadTime;




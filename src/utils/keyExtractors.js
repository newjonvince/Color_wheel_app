// utils/keyExtractors.js - Safe key extraction helpers for FlatList components

/**
 * Safe key extractor for FlatList components
 * Handles various ID formats and provides fallback for missing keys
 * 
 * @param {Object} item - The list item
 * @param {number} idx - The item index (provided by FlatList)
 * @returns {string} A unique string key for the item
 */
export const safeId = (item, idx) => {
  if (!item) return String(idx);
  
  return String(
    item.id ?? 
    item._id ?? 
    item.uuid ?? 
    item.key ?? 
    `${item.baseColor}-${idx}` ?? 
    `item-${idx}`
  );
};

/**
 * Safe key extractor for user objects
 * Specifically handles user data structures
 * 
 * @param {Object} user - The user object
 * @param {number} idx - The item index
 * @returns {string} A unique string key for the user
 */
export const safeUserId = (user, idx) => {
  if (!user) return String(idx);
  
  return String(
    user.id ?? 
    user._id ?? 
    user.userId ?? 
    user.email ?? 
    `user-${idx}`
  );
};

/**
 * Safe key extractor for post objects
 * Specifically handles post/content data structures
 * 
 * @param {Object} post - The post object
 * @param {number} idx - The item index
 * @returns {string} A unique string key for the post
 */
export const safePostId = (post, idx) => {
  if (!post) return String(idx);
  
  return String(
    post.id ?? 
    post._id ?? 
    post.postId ?? 
    post.uuid ?? 
    `${post.title}-${idx}` ?? 
    `post-${idx}`
  );
};

/**
 * Generic safe key extractor factory
 * Creates a key extractor with custom fallback logic
 * 
 * @param {Function} fallbackFn - Custom fallback function (item, idx) => string
 * @returns {Function} Key extractor function
 */
export const createSafeKeyExtractor = (fallbackFn) => {
  return (item, idx) => {
    if (!item) return String(idx);
    
    const standardKey = item.id ?? item._id ?? item.uuid ?? item.key;
    if (standardKey) return String(standardKey);
    
    return fallbackFn ? fallbackFn(item, idx) : String(idx);
  };
};

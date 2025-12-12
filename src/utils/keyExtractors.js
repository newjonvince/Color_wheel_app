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
  
  // ✅ NULLISH COALESCING FIX: Check standard ID fields first
  if (item.id != null) return String(item.id);
  if (item._id != null) return String(item._id);
  if (item.uuid != null) return String(item.uuid);
  if (item.key != null) return String(item.key);
  
  // ✅ Color-specific fallback with proper validation
  if (item.baseColor) return `${item.baseColor}-${idx}`;
  
  // ✅ Final fallback
  return `item-${idx}`;
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
  
  // ✅ NULLISH COALESCING FIX: Check standard ID fields first
  if (user.id != null) return String(user.id);
  if (user._id != null) return String(user._id);
  if (user.userId != null) return String(user.userId);
  
  // ✅ Email fallback with proper validation
  if (user.email) return String(user.email);
  
  // ✅ Final fallback
  return `user-${idx}`;
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
  
  // ✅ NULLISH COALESCING FIX: Check standard ID fields first
  if (post.id != null) return String(post.id);
  if (post._id != null) return String(post._id);
  if (post.postId != null) return String(post.postId);
  if (post.uuid != null) return String(post.uuid);
  
  // ✅ Title fallback with proper validation
  if (post.title) return `${post.title}-${idx}`;
  
  // ✅ Final fallback
  return `post-${idx}`;
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

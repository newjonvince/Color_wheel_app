// types/api.ts - Comprehensive API type definitions

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  name?: string;
  stack?: string;
}

export interface ApiCallOptions {
  signal?: AbortSignal;
  retryCount?: number;
  errorMessage?: string;
  showAlert?: boolean;
  timeout?: number;
}

export interface SafeApiCallResult<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  errorType?: ErrorType;
  userMessage?: string;
  shouldShowAlert?: boolean;
  attemptCount?: number;
}

export type ErrorType = 
  | 'authentication'
  | 'network' 
  | 'timeout'
  | 'rate_limit'
  | 'server_error'
  | 'validation'
  | 'not_found'
  | 'cancelled'
  | 'unknown';

export interface BatchApiCallOptions {
  failFast?: boolean;
  errorMessage?: string;
  signal?: AbortSignal;
}

export interface BatchApiCallResult<T = any> {
  success: boolean;
  data?: T[];
  errors?: ApiError[];
  error?: ApiError;
  partialSuccess?: boolean;
}

export interface InflightRequest {
  promise: Promise<any>;
  timestamp: number;
}

export interface CancellableRequest {
  signal: AbortSignal;
  cancel: () => void;
  isCancelled: () => boolean;
}

// API Pattern Types
export interface CommunityPost {
  id: string;
  userId: string;
  content: string;
  imageUrl?: string;
  likes: number;
  comments: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  createdAt: string;
}

export interface ColorMatch {
  id: string;
  userId: string;
  colors: string[];
  scheme: string;
  name?: string;
  tags: string[];
  isPublic: boolean;
  likes: number;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  cursor?: string;
  hasMore: boolean;
  total?: number;
}

// API Function Types
export type ApiCallFunction<T = any> = () => Promise<T>;

export type DeduplicatedApiCall = <T>(
  key: string,
  apiCall: ApiCallFunction<T>,
  options?: ApiCallOptions
) => Promise<T | { cancelled: true }>;

export type SafeApiCall = <T>(
  apiCall: ApiCallFunction<T>,
  options?: ApiCallOptions
) => Promise<SafeApiCallResult<T>>;

export type BatchApiCalls = <T>(
  apiCalls: ApiCallFunction<T>[],
  options?: BatchApiCallOptions
) => Promise<BatchApiCallResult<T>>;

// API Patterns Interface
export interface ApiPatterns {
  // Community
  loadCommunityPosts: (cursor?: string | null, options?: ApiCallOptions) => Promise<SafeApiCallResult<PaginatedResponse<CommunityPost>>>;
  loadUserProfile: (userId: string, options?: ApiCallOptions) => Promise<SafeApiCallResult<UserProfile>>;
  loadUserPosts: (userId: string, cursor?: string | null, options?: ApiCallOptions) => Promise<SafeApiCallResult<PaginatedResponse<CommunityPost>>>;
  loadUserFollowers: (userId: string, options?: ApiCallOptions) => Promise<SafeApiCallResult<PaginatedResponse<UserProfile>>>;
  
  // Color matching
  loadColorMatches: (options?: ApiCallOptions) => Promise<SafeApiCallResult<ColorMatch[]>>;
  createColorMatch: (colorMatchData: Partial<ColorMatch>, options?: ApiCallOptions) => Promise<SafeApiCallResult<ColorMatch>>;
  
  // User actions
  updateUserSettings: (settings: Partial<UserProfile>, options?: ApiCallOptions) => Promise<SafeApiCallResult<UserProfile>>;
  togglePostLike: (postId: string, isLiked: boolean, options?: ApiCallOptions) => Promise<SafeApiCallResult<void>>;
  toggleUserFollow: (userId: string, isFollowing: boolean, options?: ApiCallOptions) => Promise<SafeApiCallResult<void>>;
  
  // Utilities
  checkUsernameAvailability: (username: string, options?: ApiCallOptions) => Promise<SafeApiCallResult<{ available: boolean }>>;
  clearRequestCache: (key: string) => void;
  clearAllRequestCache: () => void;
}

// Utility Types
export interface RequestCacheUtilities {
  createCancellableRequest: () => CancellableRequest;
  cancelAllInflightRequests: () => void;
}

export type ApiHelpers = ApiPatterns & RequestCacheUtilities & {
  safeApiCall: SafeApiCall;
  batchApiCalls: BatchApiCalls;
  deduplicatedApiCall: DeduplicatedApiCall;
};

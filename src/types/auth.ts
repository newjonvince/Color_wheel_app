// types/auth.ts - TypeScript definitions for critical auth logic
// Provides type safety for authentication-related operations
import React from 'react';

export interface User {
  id: string;
  email: string;
  username: string;
  profileImage?: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  preferences?: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    email: boolean;
    push: boolean;
    marketing: boolean;
  };
  privacy: {
    profileVisibility: 'public' | 'private' | 'friends';
    showEmail: boolean;
  };
  colorWheel: {
    defaultPalette: string;
    autoSave: boolean;
    showTips: boolean;
  };
}

export interface AuthToken {
  token: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: 'Bearer';
  scope?: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  isInitialized: boolean;
  error: Error | null;
  tokenStorageType: 'secure' | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignUpData {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  acceptTerms: boolean;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthError extends Error {
  code: 'AUTH_FAILED' | 'TOKEN_EXPIRED' | 'INVALID_CREDENTIALS' | 'NETWORK_ERROR' | 'STORAGE_ERROR';
  details?: Record<string, any>;
}

export interface AuthOptions {
  signal?: AbortSignal;
  timeout?: number;
  retryCount?: number;
}

// Hook return type with all auth methods
export interface UseAuthReturn extends AuthState {
  // Authentication methods
  handleLoginSuccess: (userData: User, token: string) => Promise<void>;
  handleLogout: () => Promise<void>;
  initializeAuth: (options?: AuthOptions) => Promise<void>;
  handleSignUpComplete: (userData: User, token: string) => Promise<void>;
  handleAccountDeleted: () => Promise<void>;
  
  // Token management
  refreshToken: () => Promise<string>;
  clearTokens: () => Promise<void>;
  
  // Utility methods
  isAuthenticated: () => boolean;
  hasValidToken: () => boolean;
  getTokenExpirationTime: () => number | null;
}

// Storage interface for type safety
export interface SecureStorage {
  setToken: (token: string, refreshToken?: string) => Promise<void>;
  getToken: () => Promise<string | null>;
  clearToken: () => Promise<void>;
  setUserData: (userData: User) => Promise<void>;
  getUserData: () => Promise<User | null>;
  clearAuth: () => Promise<void>;
}

// API service interface for auth endpoints
export interface AuthApiService {
  login: (credentials: LoginCredentials, options?: AuthOptions) => Promise<AuthResponse>;
  register: (signUpData: SignUpData, options?: AuthOptions) => Promise<AuthResponse>;
  refreshToken: (refreshToken: string, options?: AuthOptions) => Promise<AuthResponse>;
  logout: (options?: AuthOptions) => Promise<void>;
  getUserProfile: (options?: AuthOptions) => Promise<User>;
  updateProfile: (userData: Partial<User>, options?: AuthOptions) => Promise<User>;
  deleteAccount: (options?: AuthOptions) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string, options?: AuthOptions) => Promise<void>;
  resetPassword: (email: string, options?: AuthOptions) => Promise<void>;
  verifyEmail: (token: string, options?: AuthOptions) => Promise<void>;
}

// Event types for auth state changes
export type AuthEventType = 
  | 'login_success'
  | 'login_failed' 
  | 'logout'
  | 'token_refreshed'
  | 'token_expired'
  | 'profile_updated'
  | 'account_deleted';

export interface AuthEvent {
  type: AuthEventType;
  timestamp: number;
  data?: any;
  error?: AuthError;
}

// Auth context provider props
export interface AuthProviderProps {
  children: React.ReactNode;
  initialState?: Partial<AuthState>;
  onAuthEvent?: (event: AuthEvent) => void;
}

// Validation schemas (for runtime validation)
export interface AuthValidationSchema {
  email: (email: string) => boolean;
  password: (password: string) => { isValid: boolean; errors: string[] };
  username: (username: string) => { isValid: boolean; errors: string[] };
}

// Permission system
export type Permission = 
  | 'read_profile'
  | 'write_profile'
  | 'delete_account'
  | 'manage_colors'
  | 'share_colors'
  | 'admin_access';

export interface UserPermissions {
  userId: string;
  permissions: Permission[];
  roles: string[];
}

// Session management
export interface SessionInfo {
  sessionId: string;
  userId: string;
  deviceId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  lastActivity: string;
  isActive: boolean;
}

// All types are already exported via their individual export statements above

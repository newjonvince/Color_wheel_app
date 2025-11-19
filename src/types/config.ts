// types/config.ts - App configuration type definitions

export interface LinkingConfig {
  prefixes: string[];
  config: {
    screens: Record<string, string>;
  };
  getStateFromPath?: (path: string, options?: any) => any;
}

export interface TabNavigationConfig {
  initialRouteName: string;
  screenOptions: {
    tabBarActiveTintColor: string;
    tabBarInactiveTintColor: string;
    headerShown: boolean;
    tabBarStyle?: Record<string, any>;
    tabBarLabelStyle?: Record<string, any>;
    tabBarIconStyle?: Record<string, any>;
  };
}

export interface AppConfig {
  linking: LinkingConfig;
  tabNavigation: TabNavigationConfig;
  performance: {
    enableHermes: boolean;
    enableFabric: boolean;
    enableTurboModules: boolean;
  };
  features: {
    enablePushNotifications: boolean;
    enableAnalytics: boolean;
    enableCrashReporting: boolean;
  };
  api: {
    baseUrl: string;
    timeout: number;
    retryAttempts: number;
  };
}

export interface LoadingState {
  stage: 'initializing' | 'auth' | 'ready';
  progress: number;
  message: string;
}

export interface InitError {
  message: string;
  stack?: string;
  code?: string;
  timestamp: number;
}

export type StatusBarStyle = 'auto' | 'inverted' | 'light' | 'dark';

export interface AppConfigFactory {
  (): AppConfig;
  reset?: () => void;
}

export interface EnvironmentConfig {
  EXPO_PUBLIC_API_URL?: string;
  EXPO_PUBLIC_DEBUG_MODE?: string;
  EXPO_PUBLIC_ENABLE_ANALYTICS?: string;
  EXPO_PUBLIC_SENTRY_DSN?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

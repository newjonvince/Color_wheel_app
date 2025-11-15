// app.config.js - Dynamic configuration for different environments
export default {
  expo: {
    name: "Fashion Color Wheel",
    slug: "fashion-color-wheel",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.fashioncolorwheel.app",
      buildNumber: "153"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.fashioncolorwheel.app",
      versionCode: 153
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-image-picker",
      [
        "expo-build-properties",
        {
          ios: {
            newArchEnabled: false
          },
          android: {
            newArchEnabled: false
          }
        }
      ],
      "expo-font",
      "expo-secure-store",
      "expo-asset"
    ],
    extra: {
      // ✅ Dynamic API configuration based on environment
      EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL || 
        'https://colorwheelapp-production.up.railway.app',
      
      // Add staging environment support
      EXPO_PUBLIC_API_STAGING_URL: process.env.EXPO_PUBLIC_API_STAGING_URL || 
        'https://colorwheelapp-staging.up.railway.app',
      
      // Environment detection
      EXPO_PUBLIC_ENVIRONMENT: process.env.EXPO_PUBLIC_ENVIRONMENT || 'production',
      
      // Feature flags
      EXPO_PUBLIC_ENABLE_ANALYTICS: process.env.EXPO_PUBLIC_ENABLE_ANALYTICS === 'true',
      EXPO_PUBLIC_ENABLE_CRASH_REPORTING: process.env.EXPO_PUBLIC_ENABLE_CRASH_REPORTING !== 'false',
      
      // Debug settings
      EXPO_PUBLIC_DEBUG_MODE: process.env.EXPO_PUBLIC_DEBUG_MODE === 'true',
      EXPO_PUBLIC_LOG_LEVEL: process.env.EXPO_PUBLIC_LOG_LEVEL || 'warn',
    },
    updates: {
      fallbackToCacheTimeout: 0
    },
    runtimeVersion: {
      policy: "sdkVersion"
    }
  }
};

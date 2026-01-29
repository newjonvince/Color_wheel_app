// app.config.js - Dynamic configuration for different environments
const EAS_PROJECT_ID = "3ac50c4a-9445-4311-a36c-b3c7f9466fbb";

export default {
  expo: {
    name: "Fashion Color Wheel",
    slug: "fashion-color-wheel",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    scheme: "colorwheel",
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
      buildNumber: "153",
      requireFullScreen: false,
      associatedDomains: ["applinks:fashioncolorwheel.app"],
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription: "This app uses the camera to capture photos and extract color information for creating fashion color palettes.",
        NSPhotoLibraryUsageDescription: "This app accesses your photo library to analyze images and extract color palettes for fashion coordination.",
        NSPhotoLibraryAddUsageDescription: "This app can save your custom color palettes and fashion combinations to your photo library.",
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: false,
          NSExceptionDomains: {
            "colorwheelapp-production.up.railway.app": {
              NSExceptionAllowsInsecureHTTPLoads: false,
              NSExceptionMinimumTLSVersion: "TLSv1.2"
            }
          }
        }
      }
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
      // ✅ EAS Build Configuration
      eas: {
        projectId: EAS_PROJECT_ID
      },
      
      EXPO_PUBLIC_NODE_ENV: process.env.NODE_ENV || 'production',

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
      // CRASH FIX: Changed from 0 to 30000ms (30 seconds)
      // fallbackToCacheTimeout: 0 causes immediate crash if updates can't be fetched
      // 30 seconds gives reasonable time for network requests without blocking app startup
      fallbackToCacheTimeout: 30000,
      enabled: true,
      // CRASH FIX: Changed from "ON_LOAD" to "ON_ERROR_RECOVERY"
      // ON_LOAD checks for updates at every launch, causing crashes on network issues
      // ON_ERROR_RECOVERY only checks after a crash, preventing crash loops
      checkAutomatically: "ON_ERROR_RECOVERY",
      url: `https://u.expo.dev/${EAS_PROJECT_ID}`
    },
    runtimeVersion: {
      policy: "sdkVersion"
    }
  }
};

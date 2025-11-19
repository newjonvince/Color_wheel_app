# Crash Reporting Setup Guide

## 🚨 Critical: Production Visibility with Sentry

Your app now has comprehensive crash reporting integration with Sentry for production visibility.

## Installation Steps

### 1. Install Sentry SDK

```bash
# For Expo managed workflow
expo install @sentry/react-native

# For bare React Native
npm install @sentry/react-native
```

### 2. Configure Environment Variables

Add these to your `app.config.js` or `.env`:

```javascript
// app.config.js
export default {
  expo: {
    // ... other config
    extra: {
      // ... other variables
      EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
      EXPO_PUBLIC_ENABLE_CRASH_REPORTING: process.env.EXPO_PUBLIC_ENABLE_CRASH_REPORTING,
      EXPO_PUBLIC_NODE_ENV: process.env.NODE_ENV,
    }
  }
};
```

### 3. Set Environment Variables

Create `.env` file:
```bash
# Production Sentry DSN (get from sentry.io)
EXPO_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id

# Enable crash reporting in development (optional)
EXPO_PUBLIC_ENABLE_CRASH_REPORTING=false

# Environment
NODE_ENV=production
```

### 4. Create Sentry Project

1. Go to [sentry.io](https://sentry.io)
2. Create account/login
3. Create new project
4. Select "React Native"
5. Copy the DSN to your environment variables

## Features Implemented

### ✅ Automatic Error Reporting
- All unhandled errors automatically reported to Sentry
- Error boundary integration
- Network error filtering (reduces noise)

### ✅ User Context Tracking
- User ID, email, username tracked with errors
- Login/logout events recorded as breadcrumbs

### ✅ Performance Monitoring
- Transaction tracking for navigation
- Performance metrics collection
- Configurable sample rates

### ✅ Breadcrumb Trail
- App initialization events
- User authentication events  
- Error boundary activations
- Custom app events

### ✅ Environment Awareness
- Different configurations for dev/prod
- Debug mode in development
- Filtered error reporting in production

## Usage Examples

### Manual Error Reporting
```javascript
import { reportError, addBreadcrumb } from './src/utils/crashReporting';

// Report an error with context
try {
  // risky operation
} catch (error) {
  reportError(error, {
    operation: 'user-action',
    userId: user.id,
    timestamp: new Date().toISOString(),
  });
}

// Add breadcrumb for debugging
addBreadcrumb('User clicked save button', 'user-action', 'info', {
  buttonId: 'save-profile',
  formValid: true,
});
```

### Performance Monitoring
```javascript
import { startTransaction } from './src/utils/crashReporting';

const transaction = startTransaction('Profile Load', 'navigation');
// ... load profile data
transaction.finish();
```

### Testing Crash Reporting
```javascript
import { testCrashReporting } from './src/utils/crashReporting';

// Test that crash reporting is working
testCrashReporting();
```

## Error Filtering

The system automatically filters out:
- Network request failures (too noisy in production)
- Cancelled/aborted requests
- Development-only errors

## Production Benefits

### 🎯 Immediate Issue Detection
- Real-time error notifications
- Crash rate monitoring
- Performance regression alerts

### 🔍 Detailed Error Context
- User information when crashes occur
- Breadcrumb trail leading to errors
- Device and app version information

### 📊 Analytics & Insights
- Most common crash causes
- Error frequency trends
- User impact analysis

### 🚀 Faster Bug Resolution
- Stack traces with source maps
- Reproduction steps via breadcrumbs
- User context for targeted fixes

## Configuration Options

### Error Reporting Levels
```javascript
// In crashReporting.js, adjust beforeSend filter:
beforeSend(event, hint) {
  const error = hint.originalException;
  
  // Skip specific error types
  if (error?.message?.includes('Network request failed')) {
    return null; // Don't report
  }
  
  return event; // Report this error
}
```

### Sample Rates
```javascript
// Adjust performance monitoring sample rate
tracesSampleRate: IS_PROD ? 0.1 : 1.0, // 10% in prod, 100% in dev
```

### User Privacy
```javascript
// Remove sensitive data before sending
beforeSend(event) {
  // Remove email from user context if needed
  if (event.user?.email) {
    delete event.user.email;
  }
  return event;
}
```

## Integration Points

### ✅ App.js Integration
- Crash reporting initialized during app startup
- Error boundary integration
- User context tracking on auth changes

### ✅ Error Boundary Integration
- UnifiedErrorBoundary automatically reports errors
- Categorized error reporting
- Breadcrumb trail for error context

### ✅ Authentication Integration
- User context set on login/logout
- Authentication events tracked as breadcrumbs

## Monitoring Dashboard

Once configured, you'll have access to:

1. **Issues Dashboard**: All crashes and errors
2. **Performance Dashboard**: App performance metrics
3. **Releases Dashboard**: Error rates per app version
4. **Alerts**: Email/Slack notifications for new issues

## Next Steps

1. **Install Sentry SDK**: `expo install @sentry/react-native`
2. **Create Sentry Project**: Get your DSN from sentry.io
3. **Configure Environment**: Add SENTRY_DSN to your environment
4. **Test Integration**: Use `testCrashReporting()` function
5. **Monitor Production**: Watch for real crashes and errors

## Cost Considerations

- Sentry has a generous free tier (5,000 errors/month)
- Paid plans start at $26/month for more volume
- Consider error filtering to stay within limits
- Performance monitoring has separate quotas

Your app now has production-grade crash reporting! 🎉

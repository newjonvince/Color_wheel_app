#!/bin/bash

# Fashion Color Wheel - iOS Deployment Script
# Run this script to build and deploy to App Store

echo "🚀 Starting Fashion Color Wheel iOS deployment..."

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "📦 Installing EAS CLI..."
    npm install -g @expo/eas-cli
fi

# Login to Expo (if not already logged in)
echo "🔐 Checking Expo authentication..."
eas whoami || eas login

# Clean install dependencies
echo "📚 Installing dependencies..."
npm ci

# Run pre-deployment checks
echo "🔍 Running pre-deployment checks..."

# Check for common issues
if grep -r "console.log" src/ --exclude-dir=node_modules; then
    echo "⚠️  Warning: Found console.log statements. Consider removing for production."
fi

# Build for iOS App Store
echo "🏗️  Building for iOS App Store..."
eas build --platform ios --profile production

echo "✅ Build complete! Check your Expo dashboard for the build status."
echo "📱 Once approved, submit to App Store Connect."

# Optional: Submit to App Store (requires Apple Developer account setup)
# echo "📤 Submitting to App Store..."
# eas submit --platform ios --latest

echo "🎉 Deployment process initiated!"
echo "📋 Next steps:"
echo "   1. Monitor build progress in Expo dashboard"
echo "   2. Download .ipa file when ready"
echo "   3. Upload to App Store Connect"
echo "   4. Complete App Store review process"

#!/bin/bash

# Fashion Color Wheel Backend - Railway Deployment Script
# Optimized for Railway platform deployment

echo "🚀 Starting Railway deployment for Fashion Color Wheel Backend..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "📦 Installing Railway CLI..."
    npm install -g @railway/cli
fi

# Login to Railway (if not already logged in)
echo "🔐 Checking Railway authentication..."
railway whoami || railway login

# Check if we're in a Railway project
if [ ! -f "railway.toml" ]; then
    echo "❌ railway.toml not found. Make sure you're in the backend directory."
    exit 1
fi

# Validate environment files
echo "🔍 Validating configuration..."
if [ ! -f ".env.production" ]; then
    echo "⚠️  Warning: .env.production not found. Make sure Railway variables are set."
fi

# Check package.json
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found. Make sure you're in the backend directory."
    exit 1
fi

# Install dependencies (for validation)
echo "📚 Installing dependencies for validation..."
npm ci --only=production

# Run basic validation
echo "🧪 Running pre-deployment validation..."
node -e "
const pkg = require('./package.json');
console.log('✅ Package.json valid');
console.log('✅ Start script:', pkg.scripts.start);
console.log('✅ Node version requirement:', pkg.engines.node);
"

# Deploy to Railway
echo "🚀 Deploying to Railway..."
railway up

echo "✅ Deployment initiated!"
echo ""
echo "📋 Next steps:"
echo "   1. Monitor deployment in Railway dashboard"
echo "   2. Check logs: railway logs"
echo "   3. Test health endpoint: https://your-app.up.railway.app/health"
echo "   4. Verify database connection and API endpoints"
echo ""
echo "🔧 Useful Railway commands:"
echo "   - railway logs          # View application logs"
echo "   - railway status        # Check deployment status"
echo "   - railway open          # Open app in browser"
echo "   - railway variables     # Manage environment variables"
echo ""
echo "🎉 Railway deployment complete!"

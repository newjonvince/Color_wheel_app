# Railway Deployment Guide for Fashion Color Wheel Backend

## Prerequisites
- Railway account (sign up at railway.app)
- GitHub repository (optional but recommended)

## Step-by-Step Deployment

### 1. Prepare Backend for Production
✅ Already done:
- `package.json` has correct start script
- `server.js` uses environment variables
- Health check endpoint exists at `/health`
- Production error handling implemented

### 2. Deploy to Railway

#### Option A: GitHub Integration (Recommended)
1. Push your code to GitHub
2. Go to railway.app → New Project → Deploy from GitHub repo
3. Select your repository
4. Choose the `backend` folder as the root directory

#### Option B: CLI Deployment
1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. In backend folder: `railway init`
4. Deploy: `railway up`

### 3. Add MySQL Database
1. In Railway dashboard → Add service → Database → MySQL
2. Railway will auto-generate connection variables:
   - `MYSQL_HOST`
   - `MYSQL_PORT` 
   - `MYSQL_DATABASE`
   - `MYSQL_USER`
   - `MYSQL_PASSWORD`

### 4. Set Environment Variables
In Railway dashboard → your service → Variables tab, add:
```
NODE_ENV=production
JWT_SECRET=your-secure-random-string-here
ALLOWED_ORIGINS=https://fashioncolorwheel.app
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads
```

### 5. Import Your Database Schema
1. Connect to Railway MySQL using provided credentials
2. Import your `database/schema.sql` file
3. Or use Railway's database management tools

### 6. Get Your Production URL
- Railway provides a public HTTPS URL like: `https://colorwheelapp-production.up.railway.app`
- Use this as your API_URL in the mobile app configs

### 7. Update Mobile App Configs
Update these files with your Railway URL:
- `app.json > extra.API_URL`
- `eas.json > build.production.env.API_URL`

## Testing
1. Test health endpoint: `https://your-railway-url.up.railway.app/health`
2. Test API endpoints with your mobile app
3. Verify database connections and CORS settings

## Security Notes
- Railway automatically provides HTTPS
- Use strong JWT_SECRET (generate with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
- Review CORS origins for production domains

# 🗄️ Fashion Color Wheel - MySQL Database Setup Guide

## 📋 Overview
This guide will help you set up your Fashion Color Wheel app with your brother's MySQL server using phpMyAdmin.

## 🎯 Database Setup Steps

### **Step 1: Access phpMyAdmin**
1. Open your browser and go to your brother's phpMyAdmin URL
2. Login with the credentials he provided
3. You should see the phpMyAdmin dashboard

### **Step 2: Create Database**
1. Click on **"Databases"** tab in phpMyAdmin
2. Enter database name: `fashion_color_wheel`
3. Select **"utf8mb4_unicode_ci"** collation (important for emoji support)
4. Click **"Create"**

### **Step 3: Import Database Schema**
1. Select your newly created `fashion_color_wheel` database
2. Click on **"SQL"** tab
3. Copy and paste the entire contents of `database/schema.sql`
4. Click **"Go"** to execute
5. You should see success messages for all table creations

### **Step 4: Verify Database Structure**
After running the schema, you should have these tables:
- ✅ `users` - User accounts and profiles
- ✅ `color_matches` - Saved color combinations
- ✅ `boards` - Pinterest-style folders
- ✅ `board_items` - Color matches saved to boards
- ✅ `user_sessions` - Authentication sessions
- ✅ `color_match_likes` - Social interactions
- ✅ `user_preferences` - User settings and preferences

## 🔧 Backend Configuration

### **Step 5: Configure Environment Variables**
1. In your `backend` folder, copy `.env.example` to `.env`
2. Update the values with your brother's server details:

```bash
# Database Configuration (MySQL)
DB_HOST=your_brother_server_ip    # e.g., 192.168.1.100
DB_PORT=3306
DB_NAME=fashion_color_wheel
DB_USER=your_mysql_username       # provided by your brother
DB_PASSWORD=your_mysql_password   # provided by your brother

# JWT Secret (generate a random string)
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random

# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration (update with your Expo dev server URL)
ALLOWED_ORIGINS=http://localhost:19006,exp://192.168.1.100:19000
```

### **Step 6: Install Backend Dependencies**
```bash
cd backend
npm install
```

### **Step 7: Test Database Connection**
```bash
npm run dev
```

You should see:
```
✅ MySQL database connection test successful
🚀 Fashion Color Wheel API server running on port 3000
```

## 📱 React Native Integration

### **Step 8: Create API Service**
Create `src/services/api.js` in your React Native app:

```javascript
const API_BASE_URL = 'http://YOUR_COMPUTER_IP:3000/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = null;
  }

  setToken(token) {
    this.token = token;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers,
      },
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }

    return data;
  }

  // Authentication
  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: userData,
    });
  }

  async login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
  }

  async checkUsername(username) {
    return this.request(`/auth/check-username/${username}`);
  }

  // Color matches
  async getColorMatches(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/colors?${queryString}`);
  }

  async createColorMatch(colorMatch) {
    return this.request('/colors', {
      method: 'POST',
      body: colorMatch,
    });
  }

  async getPublicColorMatches(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/colors/public?${queryString}`);
  }

  // Boards
  async getBoards(type) {
    const queryString = type ? `?type=${type}` : '';
    return this.request(`/boards${queryString}`);
  }

  async getBoardItems(boardId) {
    return this.request(`/boards/${boardId}/items`);
  }

  async addToBoardItems(boardId, colorMatchId) {
    return this.request(`/boards/${boardId}/items`, {
      method: 'POST',
      body: { colorMatchId },
    });
  }
}

export default new ApiService();
```

## 🚀 Testing Your Setup

### **Step 9: Test API Endpoints**
You can test your API using these curl commands or Postman:

```bash
# Health check
curl http://localhost:3000/health

# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "password123",
    "location": "United States",
    "gender": "Prefer not to say"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

## 🔒 Security Considerations

### **Important Security Notes:**
1. **Never commit your `.env` file** - it contains sensitive credentials
2. **Use strong passwords** for your MySQL user
3. **Generate a secure JWT secret** - use a random string generator
4. **Configure firewall rules** on your brother's server if needed
5. **Use HTTPS in production** - never send credentials over HTTP

## 🐛 Troubleshooting

### **Common Issues:**

#### **Connection Refused**
- Check if MySQL server is running
- Verify IP address and port
- Check firewall settings

#### **Access Denied**
- Verify username and password
- Check if user has permissions for the database
- Ensure user can connect from your IP

#### **Table Doesn't Exist**
- Make sure you ran the schema.sql file
- Check if database name is correct
- Verify all tables were created successfully

#### **CORS Errors**
- Update `ALLOWED_ORIGINS` in your `.env` file
- Include your Expo development server URL
- Restart your backend server after changes

## 📊 Database Management

### **Using phpMyAdmin:**
- **View Data:** Click on table names to see stored data
- **Run Queries:** Use the SQL tab to run custom queries
- **Export Data:** Use Export tab for backups
- **Import Data:** Use Import tab to restore backups

### **Useful SQL Queries:**
```sql
-- View all users
SELECT * FROM users;

-- View color matches with user info
SELECT cm.*, u.username 
FROM color_matches cm 
JOIN users u ON cm.user_id = u.id 
ORDER BY cm.created_at DESC;

-- View boards and their items count
SELECT b.*, COUNT(bi.id) as item_count 
FROM boards b 
LEFT JOIN board_items bi ON b.id = bi.board_id 
GROUP BY b.id;
```

## 🎉 Next Steps

Once your database is set up:
1. ✅ Update your React Native app to use the API service
2. ✅ Replace AsyncStorage calls with API calls
3. ✅ Test user registration and login
4. ✅ Test color match saving and retrieval
5. ✅ Test board functionality
6. ✅ Deploy your backend to a production server

Your Fashion Color Wheel app is now ready for production with a professional database backend! 🎨✨

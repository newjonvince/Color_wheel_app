# 🧪 Fashion Color Wheel - Integration Test Guide

## 🎯 Testing Your Database Integration

This guide will help you test your Fashion Color Wheel app's new database integration step by step.

## 📋 Pre-Test Checklist

### ✅ **Backend Setup**
1. **MySQL Database Created:** `fashion_color_wheel`
2. **Database Schema Imported:** All tables from `database/schema.sql`
3. **Backend Dependencies Installed:** `npm install` completed
4. **Environment Variables Configured:** `.env` file with correct credentials

### ✅ **React Native Updates**
1. **API Service Created:** `src/services/api.js`
2. **LoginScreen Updated:** Now uses API authentication
3. **SignupScreen Updated:** Now uses API registration

## 🚀 **Step-by-Step Testing**

### **Test 1: Backend Connection**

1. **Start your backend server:**
   ```bash
   cd C:\Users\JnVin\CascadeProjects\fashion-color-wheel\backend
   npm run dev
   ```

2. **Expected Output:**
   ```
   ✅ MySQL database connection test successful
   🚀 Fashion Color Wheel API server running on port 3000
   ```

3. **Test API Health Check:**
   - Open browser: `http://localhost:3000/health`
   - Should see: `{"status":"ok","timestamp":"..."}`

### **Test 2: Database Connection**

1. **Run the connection test:**
   ```bash
   node test-connection.js
   ```

2. **Expected Output:**
   ```
   🔍 Testing Fashion Color Wheel Backend Connection...
   
   1. Testing MySQL database connection...
   ✅ Database connection successful!
   
   2. Checking if fashion_color_wheel database exists...
   ✅ fashion_color_wheel database found!
   
   3. Checking database tables...
   ✅ Database tables found:
      - users
      - color_matches
      - boards
      - board_items
      - user_sessions
      - color_match_likes
      - user_preferences
   
   🎉 Backend connection test completed!
   ```

### **Test 3: API Endpoints**

Test your API endpoints using these curl commands:

1. **Health Check:**
   ```bash
   curl http://localhost:3000/health
   ```

2. **Register New User:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "username": "testuser",
       "password": "password123",
       "location": "United States",
       "birthday": {"month": "January", "day": "1", "year": "1990"},
       "gender": "Prefer not to say"
     }'
   ```

3. **Login User:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "password123"
     }'
   ```

4. **Check Username Availability:**
   ```bash
   curl http://localhost:3000/api/auth/check-username/newusername
   ```

### **Test 4: React Native App Integration**

1. **Start your Expo development server:**
   ```bash
   cd C:\Users\JnVin\CascadeProjects\fashion-color-wheel
   npx expo start
   ```

2. **Test User Registration:**
   - Open your app in Expo Go
   - Navigate to Sign Up screen
   - Complete the multi-step registration
   - Verify user is created in database

3. **Test User Login:**
   - Use the credentials you just created
   - Verify successful authentication
   - Check that user data is stored locally

4. **Test Demo Login:**
   - Try the "Demo Account" button
   - Should work with fallback if database demo doesn't exist

### **Test 5: Database Verification**

1. **Open phpMyAdmin**
2. **Select `fashion_color_wheel` database**
3. **Check `users` table:**
   - Should see your registered test user
   - Verify password is hashed (not plain text)
4. **Check `user_sessions` table:**
   - Should see active session for logged-in user

## 🐛 **Troubleshooting Common Issues**

### **Backend Won't Start**
- ✅ Check MySQL server is running
- ✅ Verify `.env` file credentials
- ✅ Ensure database `fashion_color_wheel` exists
- ✅ Run `npm install` in backend folder

### **Connection Refused**
- ✅ Check if port 3000 is available
- ✅ Verify firewall settings
- ✅ Update CORS origins in `.env`

### **Database Errors**
- ✅ Import `database/schema.sql` in phpMyAdmin
- ✅ Check MySQL user permissions
- ✅ Verify database name matches `.env`

### **React Native API Errors**
- ✅ Check your IP address in `api.js` (192.168.1.209)
- ✅ Ensure backend server is running
- ✅ Verify network connectivity

### **Authentication Issues**
- ✅ Check JWT_SECRET in `.env`
- ✅ Verify token storage in AsyncStorage
- ✅ Clear app data and try again

## 📊 **Expected Database Structure After Testing**

After successful testing, your database should contain:

### **`users` Table:**
```sql
SELECT id, email, username, location, created_at FROM users;
```
- Your test user account
- Demo user (if created)

### **`user_sessions` Table:**
```sql
SELECT user_id, token, expires_at FROM user_sessions WHERE expires_at > NOW();
```
- Active session tokens

### **`boards` Table:**
```sql
SELECT * FROM boards WHERE user_id = 'your_user_id';
```
- Default private/public boards for each user

## 🎉 **Success Indicators**

Your integration is successful when:

- ✅ Backend starts without errors
- ✅ Database connection test passes
- ✅ API endpoints respond correctly
- ✅ User registration works in React Native
- ✅ User login works in React Native
- ✅ Data appears in MySQL database
- ✅ JWT tokens are properly managed

## 🚀 **Next Steps After Successful Testing**

1. **Integrate Color Match Saving:**
   - Update ColorWheelScreen to save matches via API
   - Replace AsyncStorage calls with ApiService calls

2. **Implement Board Functionality:**
   - Connect Pinterest-style boards to database
   - Test saving color matches to boards

3. **Add Social Features:**
   - Test public color match sharing
   - Implement like/unlike functionality

4. **Performance Testing:**
   - Test with multiple users
   - Verify database performance

Your Fashion Color Wheel app now has professional database integration! 🎨✨

# Token Refresh Configuration

## Overview
The enhanced authentication system now supports automatic token refresh to improve user experience while maintaining security.

## Environment Variables

Add these to your `.env` file:

```env
# Token Refresh Configuration
TOKEN_REFRESH_THRESHOLD=86400          # Refresh when <24 hours remain (seconds)
TOKEN_MAX_REFRESH_AGE=604800          # Max age for refresh: 7 days (seconds)
TOKEN_REFRESH_EXPIRES_IN=7d           # New token expiration after refresh
TOKEN_AUTO_REFRESH=true               # Enable/disable auto-refresh
JWT_REFRESH_SECRET=your_refresh_secret # Optional separate secret for refresh tokens
```

## Configuration Options

### `TOKEN_REFRESH_THRESHOLD` (default: 86400)
- Time in seconds before expiration when token should be refreshed
- Default: 24 hours (86400 seconds)
- Example: Set to 3600 for 1 hour threshold

### `TOKEN_MAX_REFRESH_AGE` (default: 604800)
- Maximum age of a token before it cannot be refreshed
- Default: 7 days (604800 seconds)
- Prevents infinite token refresh chains

### `TOKEN_REFRESH_EXPIRES_IN` (default: "7d")
- Expiration time for newly refreshed tokens
- Format: "1h", "24h", "7d", etc.
- Default: 7 days

### `TOKEN_AUTO_REFRESH` (default: true)
- Enable/disable automatic token refresh
- Set to "false" to disable auto-refresh
- Manual refresh via `/auth/refresh` still works

### `JWT_REFRESH_SECRET` (optional)
- Separate secret for refresh tokens
- If not set, uses main JWT_SECRET
- Recommended for enhanced security

## How It Works

### Automatic Refresh
1. **Token Validation**: Every request checks token expiration
2. **Refresh Check**: If token expires within threshold AND is not too old
3. **New Token Generation**: Creates new token with fresh expiration
4. **Response Headers**: Sends new token in response headers
5. **Client Update**: Client should update stored token

### Response Headers (when token is refreshed)
```
X-Token-Refreshed: true
X-New-Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
X-Token-Expires: 2024-01-15T12:00:00.000Z
```

### Manual Refresh Endpoint
```
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "refresh_token_here"
}
```

## Security Features

1. **Session Tracking**: All refreshes tracked in database
2. **Refresh Limits**: Prevents infinite refresh chains
3. **Audit Logging**: All refresh events logged
4. **Token Revocation**: Can revoke all refresh tokens
5. **Fresh Token Requirement**: Sensitive operations require fresh tokens

## Client Implementation

### JavaScript Example
```javascript
// Intercept responses to check for token refresh
axios.interceptors.response.use(
  (response) => {
    if (response.headers['x-token-refreshed'] === 'true') {
      const newToken = response.headers['x-new-token'];
      localStorage.setItem('authToken', newToken);
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expired, redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### React Native Example
```javascript
// In your API service
const handleTokenRefresh = (response) => {
  if (response.headers['x-token-refreshed'] === 'true') {
    const newToken = response.headers['x-new-token'];
    AsyncStorage.setItem('authToken', newToken);
  }
};
```

## Database Schema Changes

The following columns are added to `user_sessions` table:

```sql
ALTER TABLE user_sessions 
ADD COLUMN refresh_jti VARCHAR(36) NULL,
ADD COLUMN refresh_expires_at TIMESTAMP NULL,
ADD COLUMN refresh_count INT DEFAULT 0;
```

## Migration

Run the migration to add refresh token support:

```bash
# Apply migration
mysql -u username -p database_name < migrations/002_add_refresh_token_support.sql
```

## Monitoring

Monitor refresh activity with these queries:

```sql
-- Sessions with high refresh counts
SELECT user_id, refresh_count, created_at, updated_at 
FROM user_sessions 
WHERE refresh_count > 10 
ORDER BY refresh_count DESC;

-- Recent refresh activity
SELECT u.email, us.refresh_count, us.updated_at
FROM user_sessions us
JOIN users u ON us.user_id = u.id
WHERE us.updated_at > DATE_SUB(NOW(), INTERVAL 1 DAY)
ORDER BY us.updated_at DESC;
```

## Troubleshooting

### Common Issues

1. **Tokens not refreshing**: Check `TOKEN_AUTO_REFRESH=true`
2. **Refresh failing**: Verify database migration applied
3. **Client not updating**: Check response header handling
4. **Performance issues**: Consider caching refresh decisions

### Debug Logging

Enable debug logging in development:
```env
NODE_ENV=development
LOG_LEVEL=DEBUG
```

Look for log messages:
- `🔄 Token refreshed for user X`
- `🔄 Manual token refresh for user X`
- `🚫 All refresh tokens revoked for user X`

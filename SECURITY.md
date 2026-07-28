# Security Implementation Guide

This document outlines the security features implemented in the backend API and how to properly configure the frontend to use them.

## Authentication Security

### Rate Limiting

**IP and Account-Based Rate Limiting**
- Login attempts are limited to 5 attempts per 15 minutes per IP + username combination
- Progressive delays are implemented:
  - 1st-2nd attempts: No delay
  - 3rd attempt: 1 second delay
  - 4th attempt: 2 second delay
  - 5th+ attempts: Account locked for up to 30 minutes (exponential backoff)
- Successful logins reset the attempt counter

### CORS Configuration

**Strict CORS Policy**
- Only allows requests from configured domains (`ADMIN_URL` and `CLIENT_URL`)
- Requires Origin header in production
- Credentials are enabled for cookie-based authentication
- Preflight requests are cached for 24 hours

### CSRF Protection

**Cross-Site Request Forgery Protection**
- All state-changing requests (POST, PUT, PATCH, DELETE) require a valid CSRF token
- CSRF tokens are single-use and expire after 24 hours
- Tokens are bound to user session/IP
- Get CSRF token endpoint: `GET /api/auth/csrf-token` (user) or `GET /api/admin/auth/csrf-token` (admin)

### Request Validation

**Input Validation**
- All request bodies are validated using express-validator
- Validation rules are defined in `utils/validation.js`
- Common validations include:
  - Email format validation
  - Password strength requirements (8+ chars, uppercase, lowercase, number)
  - Username format (alphanumeric + underscores, 3-30 chars)
  - Required field checks

### Activity Logging

**Comprehensive Security Logging**
All security-related events are logged to the ActivityLog collection:
- Login successes and failures (with reason)
- Logout events
- Role changes (make-admin, revoke-admin)
- Account lockouts
- All logs include: user ID, IP address, user agent, timestamp, and details

## Frontend Configuration

### Axios Configuration for Login

**IMPORTANT: Set `withCredentials: true` for all authentication requests**

```javascript
import axios from 'axios';

// Create axios instance with credentials
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
  withCredentials: true, // REQUIRED for cookie-based auth
  headers: {
    'Content-Type': 'application/json',
  },
});

// User Login
const loginUser = async (username, password) => {
  try {
    const response = await api.post('/api/auth/login', {
      username,
      password,
    });
    return response.data;
  } catch (error) {
    console.error('Login failed:', error.response?.data || error.message);
    throw error;
  }
};

// Admin Login
const loginAdmin = async (username, password) => {
  try {
    const response = await api.post('/api/admin/auth/login', {
      username,
      password,
    });
    return response.data;
  } catch (error) {
    console.error('Admin login failed:', error.response?.data || error.message);
    throw error;
  }
};
```

### CSRF Token Usage

For state-changing requests, include the CSRF token in headers:

```javascript
// Get CSRF token first
const getCSRFToken = async () => {
  const response = await api.get('/api/auth/csrf-token');
  return response.data.csrfToken;
};

// Use CSRF token in state-changing requests
const updateProfile = async (profileData) => {
  const csrfToken = await getCSRFToken();
  
  const response = await api.put('/api/user/profile', profileData, {
    headers: {
      'X-CSRF-Token': csrfToken,
    },
  });
  
  return response.data;
};
```

### Error Handling

Handle rate limiting and security errors:

```javascript
const handleApiError = (error) => {
  if (error.response?.status === 429) {
    // Rate limited
    const message = error.response.data.message;
    const remainingTime = error.response.data.remainingTime;
    console.error(`Rate limited: ${message}`);
    if (remainingTime) {
      console.error(`Try again in ${remainingTime} seconds`);
    }
  } else if (error.response?.status === 423) {
    // Account locked
    console.error('Account temporarily locked:', error.response.data.message);
  } else if (error.response?.status === 403) {
    // CSRF or permission error
    console.error('Forbidden:', error.response.data.message);
  }
  
  throw error;
};
```

## Environment Variables

Ensure these are set in your `.env` file:

```env
# Required
JWT_SECRET=your-super-secret-jwt-key
ADMIN_URL=https://your-dashboard-domain.com
CLIENT_URL=https://your-frontend-domain.com

# Optional
NODE_ENV=production
PORT=5000
```

## Security Best Practices

1. **Never expose JWT_SECRET** - Keep it secret and rotate regularly
2. **Use HTTPS in production** - All API calls should be over HTTPS
3. **Validate on both client and server** - Client validation is UX, server validation is security
4. **Implement proper error handling** - Don't expose sensitive information in error messages
5. **Monitor activity logs** - Regularly review ActivityLog for suspicious patterns
6. **Use strong passwords** - Enforce password strength requirements
7. **Implement session timeout** - Consider adding token expiration refresh logic
8. **Keep dependencies updated** - Regularly update security patches

## Testing Security Features

### Test Rate Limiting
```bash
# Attempt 6 failed logins to trigger rate limit
for i in {1..6}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"wrong"}'
done
```

### Test CORS
```bash
# Test with invalid origin (should fail in production)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Origin: https://evil.com" \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'
```

### Test CSRF Protection
```bash
# Try POST without CSRF token (should fail)
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"Test1234"}'
```

## Monitoring

Review the `ActivityLog` collection regularly for:
- Unusual login patterns (multiple failures from same IP)
- Role changes (ensure they're authorized)
- Login attempts from unknown locations
- Brute force attack patterns

Consider setting up alerts for:
- Multiple failed login attempts from same IP
- Role changes
- Account lockouts

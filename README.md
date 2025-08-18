# Backend API Server

Node.js/Express backend with MongoDB integration for user authentication.

## Setup

1. **Install dependencies:**
```bash
cd backend
npm install
```

2. **Update MongoDB connection in `config/config.js`:**
```javascript
MONGODB_URI: 'mongodb://localhost:27017/auth_system'
```

3. **Start server:**
```bash
npm run dev
```

## API Endpoints

- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login  
- `GET /api/auth/me` - Get user profile (protected)
- `GET /api/health` - Server health check

## Features

- JWT authentication
- Password hashing
- Input validation
- MongoDB integration
- CORS configuration
- Protected routes 
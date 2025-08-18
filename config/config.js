// Backend configuration
const config = {
  // MongoDB Connection String - update this with your actual MongoDB URI
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/auth_system',
  
  // JWT Secret - change this to a secure random string in production
  JWT_SECRET: process.env.JWT_SECRET || 'your_super_secret_jwt_key_here_change_this_in_production',
  
  // Server Port
  PORT: process.env.PORT || 5000,
  
  // Frontend URL for CORS
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  // JWT Token expiration
  JWT_EXPIRES_IN: '24h',
  
  // Password salt rounds for bcrypt
  SALT_ROUNDS: 12,

  // Default admin bootstrap (used to seed an admin if none exists)
  ADMIN_NAME: process.env.ADMIN_NAME || 'Administrator',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@example.com',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'Admin@123'
};

module.exports = config; 
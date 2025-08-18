// Load environment variables first
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const config = require('./config/config');
const User = require('./models/User');

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

// Initialize express app
const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(cors({
  origin: config.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Connect to MongoDB
console.log('🔍 Attempting to connect to MongoDB...');
console.log(`🔍 MongoDB URI: ${config.MONGODB_URI}`);
console.log(`🔍 Environment MONGODB_URI: ${process.env.MONGODB_URI}`);

mongoose.connect(config.MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB successfully');
    console.log(`📊 Database: ${config.MONGODB_URI}`);
    // Seed default admin if none exists
    (async () => {
      try {
        const existingAdmin = await User.findOne({ role: 'admin' });
        if (!existingAdmin) {
          const admin = new User({
            name: config.ADMIN_NAME,
            email: config.ADMIN_EMAIL,
            password: config.ADMIN_PASSWORD,
            role: 'admin',
          });
          await admin.save();
          console.log(`👑 Seeded default admin → ${config.ADMIN_EMAIL}`);
        } else {
          console.log(`👑 Admin present → ${existingAdmin.email}`);
        }
      } catch (e) {
        console.error('⚠️  Failed to seed admin user:', e);
      }
    })();
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  });

// MongoDB connection event handlers
mongoose.connection.on('error', (error) => {
  console.error('❌ MongoDB connection error:', error);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected');
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// Start server
const PORT = config.PORT;
app.listen(PORT, () => {
  console.log('🚀 Server started successfully');
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🔗 Frontend URL: ${config.FRONTEND_URL}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
  
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
  
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}); 
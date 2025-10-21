// Load environment variables first
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const config = require('./config/config');
const User = require('./models/User');

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const farmerRoutes = require('./routes/farmer');
const expertRoutes = require('./routes/expert');
const chatRoutes = require('./routes/chat');
const fieldRoutes = require('./routes/field');
const path = require('path');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');

// Initialize express app
const app = express();
const server = http.createServer(app);
let io = null;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(cors({
  origin: config.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Static files for uploaded images and audio
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/admin/uploads', express.static(path.join(__dirname, 'uploads')));

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
          // If an admin exists but email differs from configured admin email,
          // update the existing admin to match configured credentials
          if (existingAdmin.email !== config.ADMIN_EMAIL) {
            existingAdmin.email = config.ADMIN_EMAIL;
            existingAdmin.name = config.ADMIN_NAME;
            existingAdmin.password = config.ADMIN_PASSWORD; // will be hashed by pre-save
            await existingAdmin.save();
            console.log(`👑 Updated existing admin to configured email → ${config.ADMIN_EMAIL}`);
          } else {
            console.log(`👑 Admin present → ${existingAdmin.email}`);
          }
        }
      } catch (e) {
        console.error('⚠️  Failed to seed admin user:', e);
      }
    })();
    
    // Start server after MongoDB connection
    startServer();
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    console.log('⚠️  Starting server without MongoDB for development...');
    // Start server even without MongoDB for development
    startServer();
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
app.use('/api/farmer', farmerRoutes);
app.use('/api/expert', expertRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/fields', fieldRoutes);

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

// Start server function
function startServer() {
  const PORT = config.PORT;
  // Initialize Socket.IO after DB is ready
  io = new Server(server, {
    cors: {
      origin: config.FRONTEND_URL,
      credentials: true
    }
  });
  // make io accessible to routes
  app.set('io', io);

  // Socket auth using Bearer token
  io.use(async (socket, next) => {
    try {
      const authHeader = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
      if (!authHeader) return next();
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      if (!token) return next();
      const jwt = require('jsonwebtoken');
      const payload = jwt.verify(token, config.JWT_SECRET);
      const user = await User.findById(payload.userId).select('name email role isActive isBlocked');
      if (!user || user.isBlocked || user.isActive === false) return next(new Error('Unauthorized'));
      socket.user = user;
      next();
    } catch (_) {
      next();
    }
  });

  io.on('connection', (socket) => {
    // Join personal room for direct messages
    if (socket.user?._id) {
      socket.join(`user:${socket.user._id.toString()}`);
      if (socket.user.email) {
        socket.join(`email:${String(socket.user.email).toLowerCase()}`);
      }
      // Presence: mark online and notify email room
      try {
        const now = new Date();
        User.updateOne({ _id: socket.user._id }, { $set: { lastActiveAt: now } }).catch(() => {});
        io.to(`email:${String(socket.user.email).toLowerCase()}`).emit('presence', {
          email: String(socket.user.email).toLowerCase(),
          online: true,
          lastActiveAt: now.toISOString()
        });
      } catch (_) {}
    }

    // Direct message: { toUserId?, toEmail?, text }
    socket.on('send_message', async (payload = {}, ack) => {
      try {
        if (!socket.user?._id) return typeof ack === 'function' && ack({ success: false, message: 'Unauthorized' });
        const { toUserId, toEmail, text } = payload;
        if (!text || (!toUserId && !toEmail)) {
          return typeof ack === 'function' && ack({ success: false, message: 'Invalid payload' });
        }
        let targetId = toUserId;
        if (!targetId && toEmail) {
          const normalizedEmail = String(toEmail).trim().toLowerCase();
          const target = await User.findOne({ email: normalizedEmail }).select('_id email');
          if (!target) return typeof ack === 'function' && ack({ success: false, message: 'Recipient not found' });
          targetId = target._id.toString();
        }

        // Gate messaging by approval when farmer -> expert
        try {
          const ChatRequest = require('./models/ChatRequest');
          const senderIsFarmer = socket.user.role === 'user';
          const targetUser = await User.findById(targetId).select('role email');
          const targetIsExpert = targetUser?.role === 'expert';
          if (senderIsFarmer && targetIsExpert) {
            const approved = await ChatRequest.findOne({ farmerId: socket.user._id, expertId: targetId, status: 'approved' }).select('_id');
            if (!approved) {
              return typeof ack === 'function' && ack({ success: false, requiresApproval: true, message: 'Chat not approved by expert yet' });
            }
          }
        } catch (_) {}

        // Find or create conversation
        let convo = await Conversation.findOne({ participants: { $all: [socket.user._id, targetId] } });
        if (!convo) {
          const targetUser = await User.findById(targetId).select('email');
          convo = await Conversation.create({
            participants: [socket.user._id, targetId],
            participantEmails: [String(socket.user.email || '').toLowerCase(), String(targetUser?.email || '').toLowerCase()],
            lastMessageAt: new Date(),
            lastMessageText: String(text).slice(0, 2000)
          });
        }

        // Persist message
        const saved = await Message.create({
          conversationId: convo._id,
          fromUserId: socket.user._id,
          toUserId: targetId,
          fromEmail: String(socket.user.email || '').toLowerCase(),
          toEmail: String(toEmail || '').toLowerCase(),
          text: String(text).slice(0, 2000),
          readAt: null
        });

        // Update conversation summary
        await Conversation.updateOne(
          { _id: convo._id },
          { $set: { lastMessageAt: saved.createdAt, lastMessageText: saved.text } }
        );

        const outbound = {
          conversationId: convo._id.toString(),
          fromUserId: socket.user._id.toString(),
          fromName: socket.user.name,
          fromEmail: socket.user.email,
          toUserId: targetId,
          toEmail: toEmail || '',
          text: saved.text,
          ts: saved.createdAt.getTime()
        };

        // Deliver to user room and email room for robustness
        io.to(`user:${targetId}`).to(`email:${toEmail ? String(toEmail).toLowerCase() : ''}`).emit('receive_message', outbound);
        typeof ack === 'function' && ack({ success: true, message: outbound });
      } catch (e) {
        typeof ack === 'function' && ack({ success: false, message: 'Send failed' });
      }
    });

    // Typing indicator: { toUserId?, toEmail? }
    socket.on('typing', async (payload = {}) => {
      try {
        if (!socket.user?._id) return;
        const { toUserId, toEmail } = payload || {};
        let targetId = toUserId;
        let targetEmail = typeof toEmail === 'string' ? String(toEmail).trim().toLowerCase() : '';
        if (!targetId && targetEmail) {
          const target = await User.findOne({ email: targetEmail }).select('_id email');
          if (!target) return;
          targetId = target._id.toString();
        }
        if (!targetId && !targetEmail) return;
        const outbound = {
          fromUserId: socket.user._id.toString(),
          fromEmail: String(socket.user.email || '').toLowerCase()
        };
        io.to(`user:${targetId || ''}`).to(`email:${targetEmail || ''}`).emit('typing', outbound);
      } catch (_) {
        // noop
      }
    });

    socket.on('disconnect', async () => {
      try {
        if (!socket.user?._id) return;
        const now = new Date();
        await User.updateOne({ _id: socket.user._id }, { $set: { lastActiveAt: now } });
        io.to(`email:${String(socket.user.email || '').toLowerCase()}`).emit('presence', {
          email: String(socket.user.email || '').toLowerCase(),
          online: false,
          lastActiveAt: now.toISOString()
        });
      } catch (_) {}
    });
  });

  server.listen(PORT, () => {
    console.log('🚀 Server started successfully');
    console.log(`🌐 Server running on port ${PORT}`);
    console.log(`🔗 API Base URL: ${config.BACKEND_URL}/api`);
    console.log(`🔗 Health Check: ${config.BACKEND_URL}/api/health`);
    console.log(`🔗 Frontend URL: ${config.FRONTEND_URL}`);
  });
}

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
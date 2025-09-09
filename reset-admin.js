const mongoose = require('mongoose');
const User = require('./models/User');
const config = require('./config/config');

async function resetAdmin() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Remove existing admin (by role or configured email)
    await User.deleteMany({ $or: [{ role: 'admin' }, { email: config.ADMIN_EMAIL }] });
    console.log('🗑️  Removed existing admin user(s)');

    // Create new admin
    const admin = new User({
      name: config.ADMIN_NAME || 'Administrator',
      email: config.ADMIN_EMAIL,
      password: config.ADMIN_PASSWORD || 'Admin@123',
      role: 'admin',
      isActive: true,
      isBlocked: false
    });

    await admin.save();
    console.log('👑 New admin user created successfully');
    console.log('\n🔐 Admin Credentials:');
    console.log('   Email:', config.ADMIN_EMAIL);
    console.log('   Password:', config.ADMIN_PASSWORD || 'Admin@123');

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetAdmin();


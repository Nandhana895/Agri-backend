const mongoose = require('mongoose');
const User = require('./models/User');
const config = require('./config/config');

async function createAdmin() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('👑 Admin already exists:', existingAdmin.email);
      console.log('   Name:', existingAdmin.name);
      console.log('   Role:', existingAdmin.role);
      console.log('   Active:', existingAdmin.isActive);
      console.log('   Blocked:', existingAdmin.isBlocked);
    } else {
      // Create admin user
      const admin = new User({
        name: config.ADMIN_NAME,
        email: config.ADMIN_EMAIL,
        password: config.ADMIN_PASSWORD,
        role: 'admin',
        isActive: true,
        isBlocked: false
      });

      await admin.save();
      console.log('👑 Admin user created successfully');
      console.log('   Email:', admin.email);
      console.log('   Password:', config.ADMIN_PASSWORD);
    }

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createAdmin();

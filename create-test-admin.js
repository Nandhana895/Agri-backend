const mongoose = require('mongoose');
const User = require('./models/User');
const config = require('./config/config');

async function createTestAdmin() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@example.com' });
    if (existingAdmin) {
      console.log('👑 Admin already exists:');
      console.log('   Email:', existingAdmin.email);
      console.log('   Name:', existingAdmin.name);
      console.log('   Role:', existingAdmin.role);
      console.log('   Active:', existingAdmin.isActive);
      console.log('   Blocked:', existingAdmin.isBlocked);
      
      // Update password to ensure it's correct
      existingAdmin.password = 'Admin@123';
      await existingAdmin.save();
      console.log('✅ Admin password updated to: Admin@123');
    } else {
      // Create admin user
      const admin = new User({
        name: 'Administrator',
        email: 'admin@example.com',
        password: 'Admin@123',
        role: 'admin',
        isActive: true,
        isBlocked: false
      });

      await admin.save();
      console.log('👑 Admin user created successfully');
      console.log('   Email: admin@example.com');
      console.log('   Password: Admin@123');
    }

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTestAdmin();


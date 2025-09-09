const mongoose = require('mongoose');
const User = require('./models/User');
const config = require('./config/config');

async function fixAdmin() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all users
    const users = await User.find({});
    console.log('📊 Total users found:', users.length);

    if (users.length > 0) {
      console.log('\n👥 Existing users:');
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email}) - Role: ${user.role} - Active: ${user.isActive}`);
      });
    }

    // Check if admin exists (by configured email)
    let admin = await User.findOne({ email: config.ADMIN_EMAIL });
    
    if (!admin) {
      console.log('\n👑 Creating admin user...');
      admin = new User({
        name: config.ADMIN_NAME || 'Administrator',
        email: config.ADMIN_EMAIL,
        password: config.ADMIN_PASSWORD || 'Admin@123',
        role: 'admin',
        isActive: true,
        isBlocked: false
      });
      await admin.save();
      console.log('✅ Admin user created');
    } else {
      console.log('\n👑 Admin user exists, updating password...');
      admin.password = config.ADMIN_PASSWORD || 'Admin@123';
      admin.isActive = true;
      admin.isBlocked = false;
      await admin.save();
      console.log('✅ Admin user updated');
    }

    console.log('\n🔐 Admin credentials:');
    console.log('   Email:', config.ADMIN_EMAIL);
    console.log('   Password:', config.ADMIN_PASSWORD || 'Admin@123');

    // Test login
    console.log('\n🧪 Testing admin login...');
    const testLogin = await admin.comparePassword('Admin@123');
    console.log('   Password test:', testLogin ? '✅ Valid' : '❌ Invalid');

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixAdmin();


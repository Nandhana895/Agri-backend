const mongoose = require('mongoose');
const User = require('./models/User');
const config = require('./config/config');

async function checkUsers() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all users
    const users = await User.find({}).select('name email role isActive isBlocked createdAt');
    console.log('📊 Total users found:', users.length, '\n');

    if (users.length > 0) {
      console.log('👥 User List:');
      users.forEach((user, index) => {
        console.log(`${index + 1}. Name: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Active: ${user.isActive}`);
        console.log(`   Blocked: ${user.isBlocked}`);
        console.log(`   Created: ${user.createdAt.toLocaleDateString()}`);
        console.log('');
      });

      // Check for admin users
      const adminUsers = users.filter(u => u.role === 'admin');
      console.log('👑 Admin users:', adminUsers.length);
      adminUsers.forEach(admin => {
        console.log(`   - ${admin.name} (${admin.email})`);
      });
    } else {
      console.log('❌ No users found in database');
    }

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkUsers();


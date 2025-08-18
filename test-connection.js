require('dotenv').config();
const mongoose = require('mongoose');

console.log('🔍 Testing MongoDB Connection...');
console.log('🔍 Environment MONGODB_URI:', process.env.MONGODB_URI);

// Test connection without database name first
const testUri = 'mongodb+srv://nandhanasunil2026:Nandhana@cluster0.tdv63.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

console.log('🔍 Testing with URI:', testUri);

mongoose.connect(testUri)
  .then(() => {
    console.log('✅ Connected to MongoDB successfully!');
    console.log('📊 Connection state:', mongoose.connection.readyState);
    
    // List available databases
    mongoose.connection.db.admin().listDatabases()
      .then(result => {
        console.log('📚 Available databases:', result.databases.map(db => db.name));
        mongoose.connection.close();
      })
      .catch(err => {
        console.log('❌ Error listing databases:', err.message);
        mongoose.connection.close();
      });
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error.message);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error name:', error.name);
    
    if (error.code === 8000) {
      console.log('\n💡 This is an authentication error. Please check:');
      console.log('   1. Username and password are correct');
      console.log('   2. User exists in MongoDB Atlas');
      console.log('   3. User has proper permissions');
      console.log('   4. Your IP is whitelisted in MongoDB Atlas');
    }
  });

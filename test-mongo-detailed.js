const mongoose = require('mongoose');
require('dotenv').config();

const testConnection = async () => {
  try {
    console.log('🔍 Testing MongoDB connection with detailed debugging...');
    
    // Try different connection string formats
    const baseUri = 'mongodb+srv://nandhanasunil2026:Nandhana_123@cluster0.tdv63.mongodb.net';
    const uris = [
      `${baseUri}/?retryWrites=true&w=majority`,
      `${baseUri}/test?retryWrites=true&w=majority`,
      `${baseUri}/?retryWrites=true&w=majority&appName=Cluster0`,
      `${baseUri}/test?retryWrites=true&w=majority&appName=Cluster0`
    ];
    
    for (let i = 0; i < uris.length; i++) {
      console.log(`\n--- Attempting connection ${i + 1} ---`);
      console.log('URI:', uris[i]);
      
      try {
        await mongoose.connect(uris[i], {
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        });
        
        console.log('✅ MongoDB connected successfully!');
        console.log('Database name:', mongoose.connection.name);
        await mongoose.disconnect();
        process.exit(0);
      } catch (error) {
        console.log(`❌ Connection ${i + 1} failed:`, error.message);
        if (mongoose.connection.readyState !== 0) {
          await mongoose.disconnect();
        }
      }
    }
    
    console.log('\n❌ All connection attempts failed');
    process.exit(1);
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
};

testConnection();
#!/usr/bin/env node

// Script to seed fertilizer standards data
require('dotenv').config();
const mongoose = require('mongoose');
const { seedFertilizerStandards } = require('./seed-fertilizer-standards');

async function main() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/agrisense');
    console.log('📡 Connected to MongoDB');
    
    // Seed fertilizer standards
    await seedFertilizerStandards();
    
    console.log('✅ Seeding completed successfully');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

main();

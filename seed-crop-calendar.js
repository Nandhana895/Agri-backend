// Load environment variables
require('dotenv').config();

const mongoose = require('mongoose');
const CropCalendar = require('./models/CropCalendar');
const config = require('./config/config');

// Sample seed data with trustworthy sources
const seedData = [
  {
    crop: "Rice",
    crop_lower: "rice",
    season: "Kharif",
    startMonth: "June",
    endMonth: "July",
    region: "all",
    agroZone: "humid",
    notes: "Best sown during monsoon season. Requires adequate water supply.",
    varieties: ["Basmati", "Non-Basmati", "Aromatic"],
    source: "ICAR 2024",
    lastUpdated: new Date(),
    version: 1
  },
  {
    crop: "Wheat",
    crop_lower: "wheat",
    season: "Rabi",
    startMonth: "October",
    endMonth: "November",
    region: "all",
    agroZone: "temperate",
    notes: "Winter crop requiring cool temperatures for optimal growth.",
    varieties: ["HD-2967", "PBW-343", "DBW-17"],
    source: "ICAR 2024",
    lastUpdated: new Date(),
    version: 1
  },
  {
    crop: "Maize",
    crop_lower: "maize",
    season: "Kharif",
    startMonth: "May",
    endMonth: "June",
    region: "Punjab",
    agroZone: "temperate",
    notes: "High-yielding crop suitable for Punjab's climate.",
    varieties: ["PMH-1", "PMH-2", "PMH-3"],
    source: "PAU 2024",
    lastUpdated: new Date(),
    version: 1
  },
  {
    crop: "Mustard",
    crop_lower: "mustard",
    season: "Rabi",
    startMonth: "October",
    endMonth: "November",
    region: "Rajasthan",
    agroZone: "arid",
    notes: "Oilseed crop suitable for arid regions. Drought tolerant.",
    varieties: ["RH-30", "RH-406", "RH-725"],
    source: "RAU 2024",
    lastUpdated: new Date(),
    version: 1
  },
  {
    crop: "Cotton",
    crop_lower: "cotton",
    season: "Kharif",
    startMonth: "May",
    endMonth: "June",
    region: "Gujarat",
    agroZone: "semi-arid",
    notes: "Cash crop requiring warm climate and adequate irrigation.",
    varieties: ["Bollgard-II", "RCH-2", "MRC-6304"],
    source: "Gujarat Agri University 2024",
    lastUpdated: new Date(),
    version: 1
  },
  {
    crop: "Chickpea",
    crop_lower: "chickpea",
    season: "Rabi",
    startMonth: "October",
    endMonth: "November",
    region: "all",
    agroZone: "temperate",
    notes: "Pulse crop with nitrogen-fixing properties. Good for soil health.",
    varieties: ["Pusa-372", "JG-11", "Kabuli"],
    source: "ICAR 2024",
    lastUpdated: new Date(),
    version: 1
  }
];

// Function to seed the database
async function seedCropCalendar() {
  try {
    console.log('🌱 Starting CropCalendar seeding process...');
    
    // Connect to MongoDB
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data (optional - remove this if you want to keep existing data)
    const existingCount = await CropCalendar.countDocuments();
    if (existingCount > 0) {
      console.log(`🗑️  Found ${existingCount} existing records. Clearing...`);
      await CropCalendar.deleteMany({});
      console.log('✅ Cleared existing records');
    }

    // Insert seed data
    console.log('📝 Inserting seed data...');
    const insertedRecords = await CropCalendar.insertMany(seedData);
    console.log(`✅ Successfully inserted ${insertedRecords.length} records`);

    // Display inserted records
    console.log('\n📋 Inserted Records:');
    insertedRecords.forEach((record, index) => {
      console.log(`${index + 1}. ${record.crop} (${record.season}) - ${record.startMonth} to ${record.endMonth}`);
      console.log(`   Region: ${record.region} | Source: ${record.source}`);
    });

    // Verify indexes
    console.log('\n🔍 Verifying indexes...');
    const indexes = await CropCalendar.collection.getIndexes();
    console.log('📊 Available indexes:');
    Object.keys(indexes).forEach(indexName => {
      console.log(`   - ${indexName}`);
    });

    console.log('\n🎉 CropCalendar seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  } finally {
    // Close connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Function to bulk insert custom data
async function bulkInsertCropCalendar(customData) {
  try {
    console.log('🌱 Starting bulk insert process...');
    
    // Connect to MongoDB
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Validate data structure
    const requiredFields = ['crop', 'season', 'startMonth', 'endMonth'];
    const invalidRecords = customData.filter(record => 
      !requiredFields.every(field => record[field])
    );
    
    if (invalidRecords.length > 0) {
      throw new Error(`Invalid records found. Missing required fields: ${requiredFields.join(', ')}`);
    }

    // Insert data
    console.log('📝 Inserting custom data...');
    const insertedRecords = await CropCalendar.insertMany(customData);
    console.log(`✅ Successfully inserted ${insertedRecords.length} records`);

    return insertedRecords;
    
  } catch (error) {
    console.error('❌ Error during bulk insert:', error);
    throw error;
  } finally {
    // Close connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Function to update existing records
async function updateCropCalendarRecords(updates) {
  try {
    console.log('🔄 Starting update process...');
    
    // Connect to MongoDB
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const updatePromises = updates.map(async (update) => {
      const { filter, updateData } = update;
      return await CropCalendar.updateOne(filter, { $set: updateData });
    });

    const results = await Promise.all(updatePromises);
    const modifiedCount = results.reduce((sum, result) => sum + result.modifiedCount, 0);
    
    console.log(`✅ Successfully updated ${modifiedCount} records`);
    return results;
    
  } catch (error) {
    console.error('❌ Error during update:', error);
    throw error;
  } finally {
    // Close connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Export functions for use in other scripts
module.exports = {
  seedCropCalendar,
  bulkInsertCropCalendar,
  updateCropCalendarRecords,
  seedData
};

// Run seeding if this file is executed directly
if (require.main === module) {
  seedCropCalendar()
    .then(() => {
      console.log('🎯 Seeding script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seeding script failed:', error);
      process.exit(1);
    });
}

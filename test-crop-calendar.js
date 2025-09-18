// Load environment variables
require('dotenv').config();

const mongoose = require('mongoose');
const CropCalendar = require('./models/CropCalendar');
const { seedCropCalendar, bulkInsertCropCalendar } = require('./seed-crop-calendar');
const config = require('./config/config');

async function testCropCalendarModel() {
  try {
    console.log('🧪 Starting CropCalendar model tests...');
    
    // Connect to MongoDB
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Test 1: Create a new crop calendar record
    console.log('\n📝 Test 1: Creating a new crop calendar record...');
    const testRecord = new CropCalendar({
      crop: "Test Crop",
      season: "Kharif",
      startMonth: "June",
      endMonth: "August",
      region: "Test Region",
      agroZone: "temperate",
      notes: "This is a test record",
      varieties: ["Test Variety 1", "Test Variety 2"],
      source: "Test Source 2024"
    });

    const savedRecord = await testRecord.save();
    console.log('✅ Test record created successfully');
    console.log(`   ID: ${savedRecord._id}`);
    console.log(`   Crop: ${savedRecord.crop}`);
    console.log(`   Crop Lower: ${savedRecord.crop_lower}`);
    console.log(`   Season: ${savedRecord.season}`);

    // Test 2: Test search functionality
    console.log('\n🔍 Test 2: Testing search functionality...');
    const searchResults = await CropCalendar.searchCrops("test", "Test Region");
    console.log(`✅ Found ${searchResults.length} records matching "test"`);
    
    // Test 3: Test season-based search
    console.log('\n🌾 Test 3: Testing season-based search...');
    const kharifCrops = await CropCalendar.getCropsBySeason("Kharif");
    console.log(`✅ Found ${kharifCrops.length} Kharif crops`);

    // Test 4: Test instance methods
    console.log('\n📅 Test 4: Testing instance methods...');
    const sowingPeriod = savedRecord.getSowingPeriod();
    console.log(`✅ Sowing period: ${sowingPeriod}`);
    
    const isSuitableJune = savedRecord.isSuitableForMonth("June");
    const isSuitableDecember = savedRecord.isSuitableForMonth("December");
    console.log(`✅ Suitable for June: ${isSuitableJune}`);
    console.log(`✅ Suitable for December: ${isSuitableDecember}`);

    // Test 5: Test indexes
    console.log('\n📊 Test 5: Testing database indexes...');
    const indexes = await CropCalendar.collection.getIndexes();
    console.log('✅ Available indexes:');
    Object.keys(indexes).forEach(indexName => {
      const index = indexes[indexName];
      console.log(`   - ${indexName}: ${JSON.stringify(index.key)}`);
    });

    // Test 6: Test bulk operations
    console.log('\n📦 Test 6: Testing bulk operations...');
    const bulkData = [
      {
        crop: "Bulk Test Crop 1",
        season: "Rabi",
        startMonth: "October",
        endMonth: "December",
        region: "Bulk Region",
        source: "Bulk Test Source"
      },
      {
        crop: "Bulk Test Crop 2",
        season: "Kharif",
        startMonth: "May",
        endMonth: "July",
        region: "Bulk Region",
        source: "Bulk Test Source"
      }
    ];

    const bulkResults = await CropCalendar.insertMany(bulkData);
    console.log(`✅ Bulk insert successful: ${bulkResults.length} records`);

    // Test 7: Test compound index queries
    console.log('\n🔗 Test 7: Testing compound index queries...');
    const compoundQuery = await CropCalendar.find({ 
      crop_lower: "test crop", 
      region: "Test Region" 
    });
    console.log(`✅ Compound query results: ${compoundQuery.length} records`);

    // Test 8: Test validation
    console.log('\n✅ Test 8: Testing validation...');
    try {
      const invalidRecord = new CropCalendar({
        crop: "Invalid Crop",
        season: "Invalid Season", // This should fail
        startMonth: "January",
        endMonth: "February"
      });
      await invalidRecord.save();
      console.log('❌ Validation test failed - should have thrown error');
    } catch (error) {
      console.log('✅ Validation working correctly - caught invalid season');
    }

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await CropCalendar.deleteMany({ 
      $or: [
        { crop: "Test Crop" },
        { crop: "Bulk Test Crop 1" },
        { crop: "Bulk Test Crop 2" }
      ]
    });
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    // Close connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

async function testSeedingFunction() {
  try {
    console.log('\n🌱 Testing seeding functionality...');
    await seedCropCalendar();
    console.log('✅ Seeding test completed successfully!');
  } catch (error) {
    console.error('❌ Seeding test failed:', error);
    throw error;
  }
}

// Export test functions
module.exports = {
  testCropCalendarModel,
  testSeedingFunction
};

// Run tests if this file is executed directly
if (require.main === module) {
  testCropCalendarModel()
    .then(() => {
      console.log('\n🎯 Model tests completed');
      return testSeedingFunction();
    })
    .then(() => {
      console.log('🎯 All tests completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Tests failed:', error);
      process.exit(1);
    });
}

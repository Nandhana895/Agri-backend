// Load environment variables
require('dotenv').config();

const mongoose = require('mongoose');
const CropCalendar = require('./models/CropCalendar');
const { seedCropCalendar } = require('./seed-crop-calendar');
const config = require('./config/config');

// Test the sowing calendar API endpoint
async function testSowingCalendarAPI() {
  try {
    console.log('🧪 Testing Sowing Calendar API endpoint...');
    
    // Connect to MongoDB
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // First, seed some test data
    console.log('\n🌱 Seeding test data...');
    await seedCropCalendar();

    // Reconnect for testing
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Reconnected to MongoDB for testing');

    // Test 1: Basic crop search
    console.log('\n📝 Test 1: Basic crop search (Rice)');
    const riceResults = await CropCalendar.find({
      crop_lower: { $regex: 'rice', $options: 'i' }
    });
    console.log(`✅ Found ${riceResults.length} rice records`);
    riceResults.forEach(record => {
      console.log(`   - ${record.crop} (${record.season}) - ${record.startMonth} to ${record.endMonth} in ${record.region}`);
    });

    // Test 2: Region-specific search
    console.log('\n📝 Test 2: Region-specific search (Rice in Punjab)');
    const ricePunjabResults = await CropCalendar.find({
      crop_lower: { $regex: 'rice', $options: 'i' },
      region: 'Punjab'
    });
    console.log(`✅ Found ${ricePunjabResults.length} rice records for Punjab`);

    // Test 3: Season-specific search
    console.log('\n📝 Test 3: Season-specific search (Kharif crops)');
    const kharifResults = await CropCalendar.find({
      season: 'Kharif'
    });
    console.log(`✅ Found ${kharifResults.length} Kharif crops`);
    kharifResults.forEach(record => {
      console.log(`   - ${record.crop} (${record.season}) - ${record.startMonth} to ${record.endMonth}`);
    });

    // Test 4: Combined search (crop + season + region)
    console.log('\n📝 Test 4: Combined search (Wheat, Rabi, all regions)');
    const wheatRabiResults = await CropCalendar.find({
      crop_lower: { $regex: 'wheat', $options: 'i' },
      season: 'Rabi'
    });
    console.log(`✅ Found ${wheatRabiResults.length} wheat records for Rabi season`);

    // Test 5: Test the priority matching logic
    console.log('\n📝 Test 5: Testing priority matching logic');
    
    // Test exact region match
    const exactMatch = await CropCalendar.find({
      crop_lower: { $regex: 'maize', $options: 'i' },
      region: 'Punjab'
    });
    console.log(`✅ Exact region match for maize in Punjab: ${exactMatch.length} records`);

    // Test agroZone fallback
    const agroZoneMatch = await CropCalendar.find({
      crop_lower: { $regex: 'maize', $options: 'i' },
      agroZone: 'temperate'
    });
    console.log(`✅ AgroZone match for maize in temperate zone: ${agroZoneMatch.length} records`);

    // Test general fallback
    const generalMatch = await CropCalendar.find({
      crop_lower: { $regex: 'maize', $options: 'i' },
      $or: [
        { region: 'all' },
        { region: { $exists: false } }
      ]
    });
    console.log(`✅ General fallback match for maize: ${generalMatch.length} records`);

    // Test 6: Test response formatting
    console.log('\n📝 Test 6: Testing response formatting');
    const testRecord = await CropCalendar.findOne({ crop_lower: 'rice' });
    if (testRecord) {
      const formattedResult = {
        crop: testRecord.crop,
        season: testRecord.season,
        startMonth: testRecord.startMonth,
        endMonth: testRecord.endMonth,
        region: testRecord.region,
        agroZone: testRecord.agroZone,
        varieties: testRecord.varieties || [],
        notes: testRecord.notes || '',
        source: testRecord.source || '',
        lastUpdated: testRecord.lastUpdated
      };
      console.log('✅ Formatted response example:');
      console.log(JSON.stringify(formattedResult, null, 2));
    }

    // Test 7: Test validation scenarios
    console.log('\n📝 Test 7: Testing validation scenarios');
    
    // Test invalid season
    const invalidSeasonResults = await CropCalendar.find({
      crop_lower: { $regex: 'rice', $options: 'i' },
      season: 'InvalidSeason'
    });
    console.log(`✅ Invalid season query returned ${invalidSeasonResults.length} results (should be 0)`);

    // Test non-existent crop
    const nonExistentCrop = await CropCalendar.find({
      crop_lower: { $regex: 'nonexistentcrop', $options: 'i' }
    });
    console.log(`✅ Non-existent crop query returned ${nonExistentCrop.length} results (should be 0)`);

    console.log('\n🎉 All API tests completed successfully!');
    
  } catch (error) {
    console.error('❌ API test failed:', error);
    throw error;
  } finally {
    // Close connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Test the actual API endpoint simulation
async function testAPIEndpointSimulation() {
  console.log('\n🌐 Testing API endpoint simulation...');
  
  // Simulate the API endpoint logic
  const simulateAPI = async (crop, region = null, season = null) => {
    try {
      // Connect to MongoDB
      await mongoose.connect(config.MONGODB_URI);
      
      // Validate required parameters
      if (!crop) {
        return {
          status: 400,
          response: {
            success: false,
            message: 'Crop parameter is required. Please specify the crop name.'
          }
        };
      }

      // Normalize crop name (lowercase)
      const normalizedCrop = crop.toLowerCase().trim();
      
      // Build base query with crop matching
      let query = {
        crop_lower: { $regex: normalizedCrop, $options: 'i' }
      };

      // Add season filter if provided
      if (season) {
        const validSeasons = ['Kharif', 'Rabi', 'Zaid'];
        if (!validSeasons.includes(season)) {
          return {
            status: 400,
            response: {
              success: false,
              message: 'Invalid season. Must be one of: Kharif, Rabi, Zaid'
            }
          };
        }
        query.season = season;
      }

      // Priority-based matching logic
      let results = [];
      let matchExplanation = '';

      if (region) {
        // Priority 1: Exact crop + region match
        const exactRegionMatch = await CropCalendar.find({
          ...query,
          region: region
        }).sort({ lastUpdated: -1 });

        if (exactRegionMatch.length > 0) {
          results = exactRegionMatch;
          matchExplanation = `Found ${exactRegionMatch.length} exact match(es) for "${crop}" in region "${region}"`;
        } else {
          // Priority 2: Crop + agroZone match
          const commonAgroZones = ['humid', 'arid', 'temperate', 'semi-arid'];
          let agroZoneMatch = [];
          
          for (const zone of commonAgroZones) {
            const zoneResults = await CropCalendar.find({
              ...query,
              agroZone: zone
            }).sort({ lastUpdated: -1 });
            
            if (zoneResults.length > 0) {
              agroZoneMatch = zoneResults;
              matchExplanation = `Found ${zoneResults.length} match(es) for "${crop}" in agro-zone "${zone}" (region-specific data not available)`;
              break;
            }
          }

          if (agroZoneMatch.length > 0) {
            results = agroZoneMatch;
          } else {
            // Priority 3: Fallback to crop + region: "all" or general records
            const fallbackMatch = await CropCalendar.find({
              ...query,
              $or: [
                { region: 'all' },
                { region: { $exists: false } }
              ]
            }).sort({ lastUpdated: -1 });

            if (fallbackMatch.length > 0) {
              results = fallbackMatch;
              matchExplanation = `Found ${fallbackMatch.length} general match(es) for "${crop}" (no region-specific data available)`;
            }
          }
        }
      } else {
        // No region specified - get all matches for the crop
        results = await CropCalendar.find(query).sort({ lastUpdated: -1 });
        matchExplanation = `Found ${results.length} match(es) for "${crop}" across all regions`;
      }

      // If no results found
      if (results.length === 0) {
        return {
          status: 404,
          response: {
            success: false,
            message: 'No calendar found for this crop in your region. Please contact local agri-office.'
          }
        };
      }

      // Format response data
      const formattedResults = results.map(record => ({
        crop: record.crop,
        season: record.season,
        startMonth: record.startMonth,
        endMonth: record.endMonth,
        region: record.region,
        agroZone: record.agroZone,
        varieties: record.varieties || [],
        notes: record.notes || '',
        source: record.source || '',
        lastUpdated: record.lastUpdated
      }));

      // Add match explanation to response
      const response = {
        results: formattedResults,
        matchExplanation,
        totalMatches: formattedResults.length
      };

      return {
        status: 200,
        response
      };

    } catch (error) {
      return {
        status: 500,
        response: {
          success: false,
          message: 'Failed to fetch sowing calendar data. Please try again later.'
        }
      };
    } finally {
      await mongoose.connection.close();
    }
  };

  // Test various scenarios
  console.log('\n📋 Testing API scenarios:');
  
  // Test 1: Valid request
  console.log('\n1. Testing valid request (Rice, Punjab, Kharif):');
  const result1 = await simulateAPI('Rice', 'Punjab', 'Kharif');
  console.log(`Status: ${result1.status}`);
  console.log(`Response: ${JSON.stringify(result1.response, null, 2)}`);

  // Test 2: Missing crop parameter
  console.log('\n2. Testing missing crop parameter:');
  const result2 = await simulateAPI(null, 'Punjab', 'Kharif');
  console.log(`Status: ${result2.status}`);
  console.log(`Response: ${JSON.stringify(result2.response, null, 2)}`);

  // Test 3: Invalid season
  console.log('\n3. Testing invalid season:');
  const result3 = await simulateAPI('Rice', 'Punjab', 'InvalidSeason');
  console.log(`Status: ${result3.status}`);
  console.log(`Response: ${JSON.stringify(result3.response, null, 2)}`);

  // Test 4: Non-existent crop
  console.log('\n4. Testing non-existent crop:');
  const result4 = await simulateAPI('NonExistentCrop', 'Punjab', 'Kharif');
  console.log(`Status: ${result4.status}`);
  console.log(`Response: ${JSON.stringify(result4.response, null, 2)}`);

  console.log('\n🎉 API endpoint simulation completed!');
}

// Export test functions
module.exports = {
  testSowingCalendarAPI,
  testAPIEndpointSimulation
};

// Run tests if this file is executed directly
if (require.main === module) {
  testSowingCalendarAPI()
    .then(() => {
      console.log('\n🎯 Database tests completed');
      return testAPIEndpointSimulation();
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

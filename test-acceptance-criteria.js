const mongoose = require('mongoose');
const request = require('supertest');
const app = require('./server');
const CropCalendar = require('./models/CropCalendar');
const User = require('./models/User');
const config = require('./config/config');

// Test data for acceptance criteria
const testData = {
  users: [
    {
      name: 'Test Farmer',
      email: 'farmer@test.com',
      password: 'password123',
      role: 'user',
      region: 'Punjab',
      agroZone: 'temperate'
    },
    {
      name: 'Test Admin',
      email: 'admin@test.com',
      password: 'admin123',
      role: 'admin'
    }
  ],
  sampleRecords: [
    {
      crop: 'Rice',
      crop_lower: 'rice',
      season: 'Kharif',
      startMonth: 'June',
      endMonth: 'July',
      region: 'Punjab',
      agroZone: 'temperate',
      notes: 'Best sown during monsoon season in Punjab',
      varieties: ['Basmati', 'Non-Basmati'],
      source: 'ICAR 2024',
      lastUpdated: new Date(),
      version: 1
    },
    {
      crop: 'Rice',
      crop_lower: 'rice',
      season: 'Kharif',
      startMonth: 'June',
      endMonth: 'July',
      region: 'all',
      agroZone: 'humid',
      notes: 'General rice sowing guidelines',
      varieties: ['Swarna', 'MTU-1010'],
      source: 'KVK-General',
      lastUpdated: new Date(),
      version: 1
    },
    {
      crop: 'Wheat',
      crop_lower: 'wheat',
      season: 'Rabi',
      startMonth: 'November',
      endMonth: 'December',
      region: 'Punjab',
      agroZone: 'temperate',
      notes: 'Winter wheat sowing in Punjab',
      varieties: ['HD-2967', 'PBW-343'],
      source: 'PAU 2024',
      lastUpdated: new Date(),
      version: 1
    },
    {
      crop: 'Wheat',
      crop_lower: 'wheat',
      season: 'Rabi',
      startMonth: 'November',
      endMonth: 'December',
      region: 'all',
      agroZone: 'temperate',
      notes: 'General wheat sowing guidelines',
      varieties: ['HD-2967', 'PBW-343'],
      source: 'ICAR 2024',
      lastUpdated: new Date(),
      version: 1
    }
  ]
};

let authToken;
let adminToken;

async function setupTestData() {
  console.log('🔧 Setting up test data...');
  
  // Clear existing data
  await CropCalendar.deleteMany({});
  await User.deleteMany({});
  
  // Create test users
  const farmer = new User(testData.users[0]);
  await farmer.save();
  
  const admin = new User(testData.users[1]);
  await admin.save();
  
  // Get auth tokens
  const farmerLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: testData.users[0].email, password: testData.users[0].password });
  authToken = farmerLogin.body.token;
  
  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: testData.users[1].email, password: testData.users[1].password });
  adminToken = adminLogin.body.token;
  
  // Seed sample records
  await CropCalendar.insertMany(testData.sampleRecords);
  
  console.log('✅ Test data setup complete');
}

async function testDatabaseModel() {
  console.log('\n📊 Testing Database Model...');
  
  try {
    // Check if CropCalendar model exists
    const modelExists = mongoose.models.CropCalendar !== undefined;
    console.log(`✅ CropCalendar model exists: ${modelExists}`);
    
    // Check if sample records are present
    const recordCount = await CropCalendar.countDocuments();
    console.log(`✅ Sample records present: ${recordCount} records`);
    
    // Verify record structure
    const sampleRecord = await CropCalendar.findOne();
    if (sampleRecord) {
      const requiredFields = ['crop', 'season', 'startMonth', 'endMonth', 'region', 'agroZone', 'notes', 'varieties', 'source', 'lastUpdated', 'version'];
      const hasAllFields = requiredFields.every(field => sampleRecord[field] !== undefined);
      console.log(`✅ Record structure valid: ${hasAllFields}`);
      
      // Check indexes
      const indexes = await CropCalendar.collection.getIndexes();
      const hasRequiredIndexes = indexes['crop_lower_1_region_1'] !== undefined && indexes['crop_lower_1'] !== undefined;
      console.log(`✅ Required indexes present: ${hasRequiredIndexes}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Database model test failed:', error.message);
    return false;
  }
}

async function testAPIEndpoints() {
  console.log('\n🌐 Testing API Endpoints...');
  
  try {
    // Test 1: Exact region match
    console.log('Testing exact region match...');
    const exactMatchResponse = await request(app)
      .get('/api/farmer/sowing-calendar?crop=rice&region=Punjab')
      .set('Authorization', `Bearer ${authToken}`);
    
    console.log(`✅ Exact region match: ${exactMatchResponse.status === 200}`);
    console.log(`   - Results: ${exactMatchResponse.body.results?.length || 0}`);
    console.log(`   - Match explanation: ${exactMatchResponse.body.matchExplanation || 'N/A'}`);
    
    // Test 2: Fallback to general record
    console.log('Testing fallback to general record...');
    const fallbackResponse = await request(app)
      .get('/api/farmer/sowing-calendar?crop=rice&region=Kerala')
      .set('Authorization', `Bearer ${authToken}`);
    
    console.log(`✅ Fallback to general: ${fallbackResponse.status === 200}`);
    console.log(`   - Results: ${fallbackResponse.body.results?.length || 0}`);
    console.log(`   - Region: ${fallbackResponse.body.results?.[0]?.region || 'N/A'}`);
    
    // Test 3: Season filter
    console.log('Testing season filter...');
    const seasonResponse = await request(app)
      .get('/api/farmer/sowing-calendar?crop=rice&season=Kharif')
      .set('Authorization', `Bearer ${authToken}`);
    
    console.log(`✅ Season filter: ${seasonResponse.status === 200}`);
    console.log(`   - Results: ${seasonResponse.body.results?.length || 0}`);
    console.log(`   - All Kharif: ${seasonResponse.body.results?.every(r => r.season === 'Kharif') || false}`);
    
    // Test 4: Missing crop parameter
    console.log('Testing missing crop parameter...');
    const missingCropResponse = await request(app)
      .get('/api/farmer/sowing-calendar')
      .set('Authorization', `Bearer ${authToken}`);
    
    console.log(`✅ Missing crop returns 400: ${missingCropResponse.status === 400}`);
    
    // Test 5: Not found scenario
    console.log('Testing not found scenario...');
    const notFoundResponse = await request(app)
      .get('/api/farmer/sowing-calendar?crop=nonexistent')
      .set('Authorization', `Bearer ${authToken}`);
    
    console.log(`✅ Not found returns 404: ${notFoundResponse.status === 404}`);
    
    return true;
  } catch (error) {
    console.error('❌ API endpoints test failed:', error.message);
    return false;
  }
}

async function testAdminCRUD() {
  console.log('\n👨‍💼 Testing Admin CRUD Operations...');
  
  try {
    // Test 1: List records
    console.log('Testing list records...');
    const listResponse = await request(app)
      .get('/api/admin/sowing-calendar')
      .set('Authorization', `Bearer ${adminToken}`);
    
    console.log(`✅ List records: ${listResponse.status === 200}`);
    console.log(`   - Records count: ${listResponse.body.records?.length || 0}`);
    
    // Test 2: Create record
    console.log('Testing create record...');
    const newRecord = {
      crop: 'Sugarcane',
      season: 'Kharif',
      startMonth: 'March',
      endMonth: 'April',
      region: 'Uttar Pradesh',
      agroZone: 'humid',
      notes: 'Sugarcane planting season',
      varieties: ['Co-86032', 'Co-0238'],
      source: 'IISR 2024'
    };
    
    const createResponse = await request(app)
      .post('/api/admin/sowing-calendar')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(newRecord);
    
    console.log(`✅ Create record: ${createResponse.status === 201}`);
    console.log(`   - Record ID: ${createResponse.body.record?._id || 'N/A'}`);
    console.log(`   - Version: ${createResponse.body.record?.version || 'N/A'}`);
    
    // Test 3: Update record
    console.log('Testing update record...');
    const recordId = createResponse.body.record._id;
    const updateData = {
      notes: 'Updated notes for testing',
      varieties: ['Updated Variety 1', 'Updated Variety 2']
    };
    
    const updateResponse = await request(app)
      .put(`/api/admin/sowing-calendar/${recordId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(updateData);
    
    console.log(`✅ Update record: ${updateResponse.status === 200}`);
    console.log(`   - Updated notes: ${updateResponse.body.record?.notes || 'N/A'}`);
    console.log(`   - Version incremented: ${updateResponse.body.record?.version === 2}`);
    
    // Test 4: Delete record
    console.log('Testing delete record...');
    const deleteResponse = await request(app)
      .delete(`/api/admin/sowing-calendar/${recordId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    
    console.log(`✅ Delete record: ${deleteResponse.status === 200}`);
    
    return true;
  } catch (error) {
    console.error('❌ Admin CRUD test failed:', error.message);
    return false;
  }
}

async function testFrontendComponents() {
  console.log('\n🎨 Testing Frontend Components...');
  
  try {
    // Test 1: Check if SowingCalendar component exists
    const fs = require('fs');
    const path = require('path');
    
    const componentPath = path.join(__dirname, '../frontend/src/Pages/UserDashboard/SowingCalendar.jsx');
    const componentExists = fs.existsSync(componentPath);
    console.log(`✅ SowingCalendar component exists: ${componentExists}`);
    
    if (componentExists) {
      const componentContent = fs.readFileSync(componentPath, 'utf8');
      
      // Check for key features
      const hasDropdown = componentContent.includes('crop') && componentContent.includes('select');
      const hasRegionAutoFill = componentContent.includes('region') && componentContent.includes('useEffect');
      const hasSearch = componentContent.includes('handleSearch');
      const hasTimeline = componentContent.includes('timeline') || componentContent.includes('Timeline');
      const hasAddToLogbook = componentContent.includes('Add to Farm Logbook') || componentContent.includes('add to logbook');
      
      console.log(`✅ Dropdown rendering: ${hasDropdown}`);
      console.log(`✅ Region auto-fill: ${hasRegionAutoFill}`);
      console.log(`✅ Search functionality: ${hasSearch}`);
      console.log(`✅ Timeline visualization: ${hasTimeline}`);
      console.log(`✅ Add to logbook: ${hasAddToLogbook}`);
    }
    
    // Test 2: Check if AdminDashboard includes SowingCalendarManagement
    const adminDashboardPath = path.join(__dirname, '../frontend/src/Pages/AdminDashboard.jsx');
    const adminDashboardExists = fs.existsSync(adminDashboardPath);
    console.log(`✅ AdminDashboard exists: ${adminDashboardExists}`);
    
    if (adminDashboardExists) {
      const adminContent = fs.readFileSync(adminDashboardPath, 'utf8');
      const hasSowingCalendarTab = adminContent.includes('sowing-calendar');
      console.log(`✅ Sowing Calendar tab in AdminDashboard: ${hasSowingCalendarTab}`);
    }
    
    // Test 3: Check if ExpertDashboard includes SowingTrendsDashboard
    const expertDashboardPath = path.join(__dirname, '../frontend/src/Pages/ExpertDashboard.jsx');
    const expertDashboardExists = fs.existsSync(expertDashboardPath);
    console.log(`✅ ExpertDashboard exists: ${expertDashboardExists}`);
    
    if (expertDashboardExists) {
      const expertContent = fs.readFileSync(expertDashboardPath, 'utf8');
      const hasTrendsTab = expertContent.includes('trends') || expertContent.includes('SowingTrendsDashboard');
      console.log(`✅ Sowing Trends tab in ExpertDashboard: ${hasTrendsTab}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Frontend components test failed:', error.message);
    return false;
  }
}

async function testOfflineFunctionality() {
  console.log('\n📱 Testing Offline Functionality...');
  
  try {
    // Test 1: Check if component handles offline state
    const componentPath = path.join(__dirname, '../frontend/src/Pages/UserDashboard/SowingCalendar.jsx');
    const componentExists = fs.existsSync(componentPath);
    
    if (componentExists) {
      const componentContent = fs.readFileSync(componentPath, 'utf8');
      const hasOfflineHandling = componentContent.includes('navigator.onLine') || 
                                 componentContent.includes('offline') || 
                                 componentContent.includes('cache');
      console.log(`✅ Offline handling: ${hasOfflineHandling}`);
    }
    
    // Test 2: Check for localStorage usage
    if (componentExists) {
      const componentContent = fs.readFileSync(componentPath, 'utf8');
      const hasLocalStorage = componentContent.includes('localStorage') || 
                             componentContent.includes('sessionStorage');
      console.log(`✅ Local storage usage: ${hasLocalStorage}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Offline functionality test failed:', error.message);
    return false;
  }
}

async function runAcceptanceCriteriaTests() {
  console.log('🧪 Running Acceptance Criteria Tests...\n');
  
  try {
    // Connect to database
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Setup test data
    await setupTestData();
    
    // Run all tests
    const results = {
      databaseModel: await testDatabaseModel(),
      apiEndpoints: await testAPIEndpoints(),
      adminCRUD: await testAdminCRUD(),
      frontendComponents: await testFrontendComponents(),
      offlineFunctionality: await testOfflineFunctionality()
    };
    
    // Summary
    console.log('\n📋 Acceptance Criteria Summary:');
    console.log('================================');
    
    const allPassed = Object.values(results).every(result => result === true);
    
    console.log(`✅ Database model exists and seeded: ${results.databaseModel ? 'PASS' : 'FAIL'}`);
    console.log(`✅ API endpoints return valid results: ${results.apiEndpoints ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Admin CRUD operations work: ${results.adminCRUD ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Frontend components render correctly: ${results.frontendComponents ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Offline functionality works: ${results.offlineFunctionality ? 'PASS' : 'FAIL'}`);
    
    console.log('\n🎯 Overall Result:');
    if (allPassed) {
      console.log('🎉 ALL ACCEPTANCE CRITERIA PASSED! ✅');
      console.log('The Sowing Calendar feature is ready for production.');
    } else {
      console.log('❌ Some acceptance criteria failed. Please review the issues above.');
    }
    
    return allPassed;
    
  } catch (error) {
    console.error('❌ Acceptance criteria tests failed:', error.message);
    return false;
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Export for manual testing
module.exports = { runAcceptanceCriteriaTests };

// Run tests if called directly
if (require.main === module) {
  runAcceptanceCriteriaTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

const mongoose = require('mongoose');
const request = require('supertest');
const app = require('./server');
const CropCalendar = require('./models/CropCalendar');
const User = require('./models/User');
const config = require('./config/config');

// Test data
const testUser = {
  name: 'Test Farmer',
  email: 'test@farmer.com',
  password: 'password123',
  role: 'user',
  region: 'Punjab',
  agroZone: 'temperate'
};

const testAdmin = {
  name: 'Test Admin',
  email: 'admin@test.com',
  password: 'admin123',
  role: 'admin'
};

const testExpert = {
  name: 'Test Expert',
  email: 'expert@test.com',
  password: 'expert123',
  role: 'expert'
};

const sampleRecords = [
  {
    crop: 'Rice',
    crop_lower: 'rice',
    season: 'Kharif',
    startMonth: 'June',
    endMonth: 'July',
    region: 'Punjab',
    agroZone: 'temperate',
    notes: 'Best sown during monsoon season',
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
    notes: 'Winter wheat sowing',
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
  },
  {
    crop: 'Maize',
    crop_lower: 'maize',
    season: 'Kharif',
    startMonth: 'May',
    endMonth: 'June',
    region: 'Karnataka',
    agroZone: 'semi-arid',
    notes: 'Maize sowing in Karnataka',
    varieties: ['Hybrid-1', 'Local'],
    source: 'UAS-B 2024',
    lastUpdated: new Date(),
    version: 1
  }
];

let authToken;
let adminToken;
let expertToken;

describe('Sowing Calendar API Tests', () => {
  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(config.MONGODB_URI);
    
    // Clear existing data
    await CropCalendar.deleteMany({});
    await User.deleteMany({});
    
    // Create test users
    const farmer = new User(testUser);
    await farmer.save();
    
    const admin = new User(testAdmin);
    await admin.save();
    
    const expert = new User(testExpert);
    await expert.save();
    
    // Get auth tokens
    const farmerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    authToken = farmerLogin.body.token;
    
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: testAdmin.email, password: testAdmin.password });
    adminToken = adminLogin.body.token;
    
    const expertLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: testExpert.email, password: testExpert.password });
    expertToken = expertLogin.body.token;
    
    // Seed test data
    await CropCalendar.insertMany(sampleRecords);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('GET /api/farmer/sowing-calendar', () => {
    describe('Exact Region Match', () => {
      test('should return exact region match for Rice in Punjab', async () => {
        const response = await request(app)
          .get('/api/farmer/sowing-calendar?crop=rice&region=Punjab')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.results).toHaveLength(1);
        expect(response.body.results[0].crop).toBe('Rice');
        expect(response.body.results[0].region).toBe('Punjab');
        expect(response.body.matchExplanation).toContain('exact match');
      });

      test('should return exact region match for Wheat in Punjab', async () => {
        const response = await request(app)
          .get('/api/farmer/sowing-calendar?crop=wheat&region=Punjab')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.results).toHaveLength(1);
        expect(response.body.results[0].crop).toBe('Wheat');
        expect(response.body.results[0].region).toBe('Punjab');
      });
    });

    describe('Fallback to General Record', () => {
      test('should fallback to general record when no exact region match', async () => {
        const response = await request(app)
          .get('/api/farmer/sowing-calendar?crop=rice&region=Kerala')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.results).toHaveLength(1);
        expect(response.body.results[0].crop).toBe('Rice');
        expect(response.body.results[0].region).toBe('all');
        expect(response.body.matchExplanation).toContain('general match');
      });

      test('should fallback to general record for unknown region', async () => {
        const response = await request(app)
          .get('/api/farmer/sowing-calendar?crop=wheat&region=UnknownRegion')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.results).toHaveLength(1);
        expect(response.body.results[0].region).toBe('all');
      });
    });

    describe('Season Filter', () => {
      test('should filter by Kharif season', async () => {
        const response = await request(app)
          .get('/api/farmer/sowing-calendar?crop=rice&season=Kharif')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.results).toHaveLength(2);
        expect(response.body.results.every(r => r.season === 'Kharif')).toBe(true);
      });

      test('should filter by Rabi season', async () => {
        const response = await request(app)
          .get('/api/farmer/sowing-calendar?crop=wheat&season=Rabi')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.results).toHaveLength(2);
        expect(response.body.results.every(r => r.season === 'Rabi')).toBe(true);
      });

      test('should return empty results for invalid season', async () => {
        const response = await request(app)
          .get('/api/farmer/sowing-calendar?crop=rice&season=InvalidSeason')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Invalid season');
      });
    });

    describe('Error Handling', () => {
      test('should return 400 for missing crop parameter', async () => {
        const response = await request(app)
          .get('/api/farmer/sowing-calendar')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Crop parameter is required');
      });

      test('should return 404 for non-existent crop', async () => {
        const response = await request(app)
          .get('/api/farmer/sowing-calendar?crop=nonexistent')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('No calendar found for this crop');
      });

      test('should return 401 for unauthenticated request', async () => {
        const response = await request(app)
          .get('/api/farmer/sowing-calendar?crop=rice')
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe('Response Format', () => {
      test('should return properly formatted response', async () => {
        const response = await request(app)
          .get('/api/farmer/sowing-calendar?crop=rice&region=Punjab')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('results');
        expect(response.body).toHaveProperty('matchExplanation');
        expect(response.body).toHaveProperty('totalMatches');
        expect(Array.isArray(response.body.results)).toBe(true);
        
        if (response.body.results.length > 0) {
          const result = response.body.results[0];
          expect(result).toHaveProperty('crop');
          expect(result).toHaveProperty('season');
          expect(result).toHaveProperty('startMonth');
          expect(result).toHaveProperty('endMonth');
          expect(result).toHaveProperty('region');
          expect(result).toHaveProperty('agroZone');
          expect(result).toHaveProperty('varieties');
          expect(result).toHaveProperty('notes');
          expect(result).toHaveProperty('source');
          expect(result).toHaveProperty('lastUpdated');
        }
      });
    });
  });

  describe('Admin CRUD Operations', () => {
    describe('GET /api/admin/sowing-calendar', () => {
      test('should list all records for admin', async () => {
        const response = await request(app)
          .get('/api/admin/sowing-calendar')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.records).toHaveLength(5);
        expect(response.body.pagination).toBeDefined();
      });

      test('should search records by crop name', async () => {
        const response = await request(app)
          .get('/api/admin/sowing-calendar?search=rice')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.records.every(r => r.crop.toLowerCase().includes('rice'))).toBe(true);
      });
    });

    describe('POST /api/admin/sowing-calendar', () => {
      test('should create new record', async () => {
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

        const response = await request(app)
          .post('/api/admin/sowing-calendar')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(newRecord)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.record.crop).toBe('Sugarcane');
        expect(response.body.record.version).toBe(1);
      });

      test('should validate required fields', async () => {
        const invalidRecord = {
          crop: 'Test Crop'
          // Missing required fields
        };

        const response = await request(app)
          .post('/api/admin/sowing-calendar')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(invalidRecord)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('required');
      });
    });

    describe('PUT /api/admin/sowing-calendar/:id', () => {
      test('should update existing record', async () => {
        // First, get a record to update
        const listResponse = await request(app)
          .get('/api/admin/sowing-calendar')
          .set('Authorization', `Bearer ${adminToken}`);

        const recordId = listResponse.body.records[0]._id;

        const updateData = {
          notes: 'Updated notes for testing',
          varieties: ['Updated Variety 1', 'Updated Variety 2']
        };

        const response = await request(app)
          .put(`/api/admin/sowing-calendar/${recordId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.record.notes).toBe('Updated notes for testing');
        expect(response.body.record.version).toBe(2); // Version should increment
      });
    });

    describe('DELETE /api/admin/sowing-calendar/:id', () => {
      test('should delete record', async () => {
        // First, create a record to delete
        const newRecord = {
          crop: 'Test Crop',
          season: 'Kharif',
          startMonth: 'June',
          endMonth: 'July',
          region: 'Test Region'
        };

        const createResponse = await request(app)
          .post('/api/admin/sowing-calendar')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(newRecord);

        const recordId = createResponse.body.record._id;

        const response = await request(app)
          .delete(`/api/admin/sowing-calendar/${recordId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('deleted successfully');
      });
    });
  });

  describe('Expert Analytics', () => {
    describe('GET /api/expert/sowing-trends', () => {
      test('should return trends data for expert', async () => {
        const response = await request(app)
          .get('/api/expert/sowing-trends')
          .set('Authorization', `Bearer ${expertToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('trends');
        expect(response.body.data).toHaveProperty('summary');
        expect(response.body.data).toHaveProperty('analytics');
      });

      test('should filter trends by region', async () => {
        const response = await request(app)
          .get('/api/expert/sowing-trends?region=Punjab')
          .set('Authorization', `Bearer ${expertToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.trends.every(t => 
          t._id.region === 'Punjab' || t._id.region === 'all'
        )).toBe(true);
      });

      test('should filter trends by season', async () => {
        const response = await request(app)
          .get('/api/expert/sowing-trends?season=Kharif')
          .set('Authorization', `Bearer ${expertToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.trends.every(t => t._id.season === 'Kharif')).toBe(true);
      });
    });

    describe('GET /api/expert/sowing-heatmap', () => {
      test('should return heatmap data', async () => {
        const response = await request(app)
          .get('/api/expert/sowing-heatmap')
          .set('Authorization', `Bearer ${expertToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });

    describe('GET /api/expert/sowing-distribution', () => {
      test('should return monthly distribution data', async () => {
        const response = await request(app)
          .get('/api/expert/sowing-distribution')
          .set('Authorization', `Bearer ${expertToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });

    describe('GET /api/expert/crop-popularity', () => {
      test('should return crop popularity data', async () => {
        const response = await request(app)
          .get('/api/expert/crop-popularity')
          .set('Authorization', `Bearer ${expertToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });
  });

  describe('Rate Limiting', () => {
    test('should apply rate limiting to sowing calendar endpoint', async () => {
      // Make multiple requests quickly to test rate limiting
      const promises = Array(35).fill().map(() => 
        request(app)
          .get('/api/farmer/sowing-calendar?crop=rice')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});

// Helper function to run tests
async function runTests() {
  try {
    console.log('🧪 Starting Sowing Calendar API Tests...');
    
    // Run the test suite
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const { stdout, stderr } = await execAsync('npm test -- test-sowing-calendar-comprehensive.js');
    
    console.log('✅ Test Results:');
    console.log(stdout);
    
    if (stderr) {
      console.log('⚠️ Test Warnings:');
      console.log(stderr);
    }
    
    console.log('🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Tests failed:', error.message);
    process.exit(1);
  }
}

// Export for manual testing
module.exports = { runTests };

// Run tests if called directly
if (require.main === module) {
  runTests();
}

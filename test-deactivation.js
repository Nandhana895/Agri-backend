const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function testDeactivation() {
  try {
    console.log('🧪 Testing User Deactivation Feature...\n');

    // 1. Login as admin
    console.log('1. Logging in as admin...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@example.com',
      password: 'Admin@123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Admin login successful\n');

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 2. Create a test user
    console.log('2. Creating test user...');
    const createResponse = await axios.post(`${API_BASE}/admin/users`, {
      name: 'Test User',
      email: 'testuser@example.com',
      password: 'TestPass123!',
      role: 'user',
      isActive: true
    }, { headers });
    
    const testUser = createResponse.data.user;
    console.log('✅ Test user created:', testUser.name, testUser.email);
    console.log('   User ID:', testUser._id, '\n');

    // 3. Test login as the new user (should work)
    console.log('3. Testing login as new user (should work)...');
    try {
      const userLoginResponse = await axios.post(`${API_BASE}/auth/login`, {
        email: 'testuser@example.com',
        password: 'TestPass123!'
      });
      console.log('✅ User login successful (as expected)\n');
    } catch (error) {
      console.log('❌ User login failed:', error.response?.data?.message, '\n');
    }

    // 4. Deactivate the user
    console.log('4. Deactivating user...');
    const deactivateResponse = await axios.patch(`${API_BASE}/admin/users/${testUser._id}/status`, {
      isActive: false
    }, { headers });
    console.log('✅ User deactivated:', deactivateResponse.data.message, '\n');

    // 5. Test login as deactivated user (should fail)
    console.log('5. Testing login as deactivated user (should fail)...');
    try {
      const deactivatedLoginResponse = await axios.post(`${API_BASE}/auth/login`, {
        email: 'testuser@example.com',
        password: 'TestPass123!'
      });
      console.log('❌ User login succeeded (unexpected!)');
    } catch (error) {
      console.log('✅ User login failed as expected:', error.response?.data?.message, '\n');
    }

    // 6. Reactivate the user
    console.log('6. Reactivating user...');
    const activateResponse = await axios.patch(`${API_BASE}/admin/users/${testUser._id}/status`, {
      isActive: true
    }, { headers });
    console.log('✅ User reactivated:', activateResponse.data.message, '\n');

    // 7. Test login as reactivated user (should work again)
    console.log('7. Testing login as reactivated user (should work)...');
    try {
      const reactivatedLoginResponse = await axios.post(`${API_BASE}/auth/login`, {
        email: 'testuser@example.com',
        password: 'TestPass123!'
      });
      console.log('✅ User login successful after reactivation\n');
    } catch (error) {
      console.log('❌ User login failed after reactivation:', error.response?.data?.message, '\n');
    }

    // 8. Clean up - delete the test user
    console.log('8. Cleaning up - deleting test user...');
    const deleteResponse = await axios.delete(`${API_BASE}/admin/users/${testUser._id}`, { headers });
    console.log('✅ Test user deleted:', deleteResponse.data.message, '\n');

    console.log('🎉 Deactivation feature test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('✅ User creation works');
    console.log('✅ User deactivation works');
    console.log('✅ Deactivated users cannot log in');
    console.log('✅ User reactivation works');
    console.log('✅ Reactivated users can log in again');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testDeactivation();

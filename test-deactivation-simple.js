const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function testDeactivationSimple() {
  try {
    console.log('🧪 Testing Deactivation API...\n');

    // 1. Login as admin
    console.log('1. Logging in as admin...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@example.com',
      password: 'Admin@123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Admin login successful');
    console.log('   Token:', token.substring(0, 20) + '...\n');

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 2. Get list of users
    console.log('2. Getting list of users...');
    const usersResponse = await axios.get(`${API_BASE}/admin/users?limit=5`, { headers });
    const users = usersResponse.data.users;
    console.log('✅ Users retrieved:', users.length, 'users found');
    
    if (users.length > 0) {
      const testUser = users.find(u => u.role === 'user') || users[0];
      console.log('   Test user:', testUser.name, testUser.email);
      console.log('   Current status - Active:', testUser.isActive, 'Blocked:', testUser.isBlocked, '\n');

      // 3. Try to deactivate the user
      console.log('3. Attempting to deactivate user...');
      try {
        const deactivateResponse = await axios.patch(`${API_BASE}/admin/users/${testUser._id}/status`, {
          isActive: false
        }, { headers });
        
        console.log('✅ Deactivation successful!');
        console.log('   Response:', deactivateResponse.data.message);
        console.log('   New status - Active:', deactivateResponse.data.user.isActive, '\n');

        // 4. Try to reactivate the user
        console.log('4. Attempting to reactivate user...');
        const activateResponse = await axios.patch(`${API_BASE}/admin/users/${testUser._id}/status`, {
          isActive: true
        }, { headers });
        
        console.log('✅ Reactivation successful!');
        console.log('   Response:', activateResponse.data.message);
        console.log('   New status - Active:', activateResponse.data.user.isActive, '\n');

      } catch (deactivateError) {
        console.log('❌ Deactivation failed!');
        console.log('   Error:', deactivateError.response?.data?.message || deactivateError.message);
        console.log('   Status:', deactivateError.response?.status);
        console.log('   Data:', deactivateError.response?.data);
      }
    } else {
      console.log('❌ No users found to test with');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.error('Response data:', error.response.data);
    }
    if (error.response?.status) {
      console.error('Status code:', error.response.status);
    }
  }
}

// Run the test
testDeactivationSimple();


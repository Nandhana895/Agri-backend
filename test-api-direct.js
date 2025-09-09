const axios = require('axios');

async function testAPI() {
  try {
    console.log('🧪 Testing API endpoints directly...\n');

    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get('http://localhost:5000/api/health');
    console.log('✅ Health check:', healthResponse.data.message);
    console.log('   Database:', healthResponse.data.database, '\n');

    // Test admin users endpoint without auth (should fail)
    console.log('2. Testing admin users endpoint without auth...');
    try {
      await axios.get('http://localhost:5000/api/admin/users');
      console.log('❌ Should have failed but succeeded');
    } catch (error) {
      console.log('✅ Correctly failed with:', error.response?.status, error.response?.data?.message, '\n');
    }

    // Test login endpoint
    console.log('3. Testing login with admin credentials...');
    try {
      const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
        email: 'admin@example.com',
        password: 'Admin@123'
      });
      console.log('✅ Login successful');
      console.log('   Token length:', loginResponse.data.token.length);
      console.log('   User role:', loginResponse.data.user.role, '\n');

      // Test admin users endpoint with auth
      console.log('4. Testing admin users endpoint with auth...');
      const usersResponse = await axios.get('http://localhost:5000/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${loginResponse.data.token}`
        }
      });
      console.log('✅ Users endpoint successful');
      console.log('   Users found:', usersResponse.data.users.length);
      console.log('   Pagination:', usersResponse.data.pagination, '\n');

      if (usersResponse.data.users.length > 0) {
        const testUser = usersResponse.data.users.find(u => u.role === 'user') || usersResponse.data.users[0];
        console.log('5. Testing deactivation on user:', testUser.name);
        console.log('   Current status - Active:', testUser.isActive, 'Blocked:', testUser.isBlocked);

        try {
          const deactivateResponse = await axios.patch(`http://localhost:5000/api/admin/users/${testUser._id}/status`, {
            isActive: false
          }, {
            headers: {
              'Authorization': `Bearer ${loginResponse.data.token}`,
              'Content-Type': 'application/json'
            }
          });
          console.log('✅ Deactivation successful');
          console.log('   Message:', deactivateResponse.data.message);
          console.log('   New status - Active:', deactivateResponse.data.user.isActive, '\n');

          // Reactivate
          console.log('6. Testing reactivation...');
          const activateResponse = await axios.patch(`http://localhost:5000/api/admin/users/${testUser._id}/status`, {
            isActive: true
          }, {
            headers: {
              'Authorization': `Bearer ${loginResponse.data.token}`,
              'Content-Type': 'application/json'
            }
          });
          console.log('✅ Reactivation successful');
          console.log('   Message:', activateResponse.data.message);
          console.log('   New status - Active:', activateResponse.data.user.isActive, '\n');

        } catch (deactivateError) {
          console.log('❌ Deactivation failed');
          console.log('   Error:', deactivateError.response?.data?.message);
          console.log('   Status:', deactivateError.response?.status);
          console.log('   Data:', deactivateError.response?.data);
        }
      }

    } catch (loginError) {
      console.log('❌ Login failed');
      console.log('   Error:', loginError.response?.data?.message);
      console.log('   Status:', loginError.response?.status);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAPI();


const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

// Test user data
const testUser = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'TestPass123!',
  role: 'user',
  isActive: true
};

async function testUserCRUD() {
  try {
    console.log('🧪 Testing User CRUD Operations...\n');

    // 1. Login as admin to get token
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

    // 2. Create a new user
    console.log('2. Creating new user...');
    const createResponse = await axios.post(`${API_BASE}/admin/users`, testUser, { headers });
    const createdUser = createResponse.data.user;
    console.log('✅ User created:', createdUser.name, createdUser.email);
    console.log('   User ID:', createdUser._id, '\n');

    // 3. Get user details
    console.log('3. Getting user details...');
    const getResponse = await axios.get(`${API_BASE}/admin/users/${createdUser._id}`, { headers });
    console.log('✅ User details retrieved:', getResponse.data.user.name, '\n');

    // 4. Update user
    console.log('4. Updating user...');
    const updateResponse = await axios.put(`${API_BASE}/admin/users/${createdUser._id}`, {
      name: 'Updated Test User',
      role: 'admin'
    }, { headers });
    console.log('✅ User updated:', updateResponse.data.user.name, '\n');

    // 5. Block user
    console.log('5. Blocking user...');
    const blockResponse = await axios.patch(`${API_BASE}/admin/users/${createdUser._id}/block`, {
      isBlocked: true
    }, { headers });
    console.log('✅ User blocked:', blockResponse.data.message, '\n');

    // 6. Unblock user
    console.log('6. Unblocking user...');
    const unblockResponse = await axios.patch(`${API_BASE}/admin/users/${createdUser._id}/block`, {
      isBlocked: false
    }, { headers });
    console.log('✅ User unblocked:', unblockResponse.data.message, '\n');

    // 7. Deactivate user
    console.log('7. Deactivating user...');
    const deactivateResponse = await axios.patch(`${API_BASE}/admin/users/${createdUser._id}/status`, {
      isActive: false
    }, { headers });
    console.log('✅ User deactivated:', deactivateResponse.data.message, '\n');

    // 8. Activate user
    console.log('8. Activating user...');
    const activateResponse = await axios.patch(`${API_BASE}/admin/users/${createdUser._id}/status`, {
      isActive: true
    }, { headers });
    console.log('✅ User activated:', activateResponse.data.message, '\n');

    // 9. List users
    console.log('9. Listing users...');
    const listResponse = await axios.get(`${API_BASE}/admin/users?limit=5`, { headers });
    console.log('✅ Users listed:', listResponse.data.users.length, 'users found');
    console.log('   Pagination:', listResponse.data.pagination, '\n');

    // 10. Delete user
    console.log('10. Deleting user...');
    const deleteResponse = await axios.delete(`${API_BASE}/admin/users/${createdUser._id}`, { headers });
    console.log('✅ User deleted:', deleteResponse.data.message, '\n');

    console.log('🎉 All CRUD operations completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testUserCRUD();

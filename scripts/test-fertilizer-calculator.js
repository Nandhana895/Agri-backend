/*
 Simple smoke test for Fertilizer Calculator API:
 - Logs in with configured admin credentials from backend/config/config.js
 - Calls /api/farmer/fertilizer-calculator for several crop/region pairs
 - Prints unit and recommended NPK for quick verification
*/

const axios = require('axios');

async function main() {
  const base = process.env.API_BASE || 'http://localhost:5000/api';

  try {
    // Login using configured admin email/password from config defaults
    const email = process.env.ADMIN_EMAIL || 'nandhanas366@gmail.com';
    const password = process.env.ADMIN_PASSWORD || 'Admin@123';

    const loginResp = await axios.post(`${base}/auth/login`, { email, password });
    const token = loginResp.data && loginResp.data.token;
    if (!token) {
      throw new Error('Login succeeded but no token returned');
    }
    console.log('✅ Login OK');

    const headers = { Authorization: `Bearer ${token}` };

    const tests = [
      { crop: 'Rice', region: 'Kerala', landSize: 1, landUnit: 'acre' },
      { crop: 'Wheat', region: 'Punjab', landSize: 0.5, landUnit: 'hectare' },
      { crop: 'Banana', region: 'Tamil Nadu', landSize: 800, landUnit: 'sqm' },
      { crop: 'Black Pepper', region: 'Gujarat', landSize: 3, landUnit: 'acre' }
    ];

    for (const t of tests) {
      const { data } = await axios.post(`${base}/farmer/fertilizer-calculator`, t, { headers });
      if (!data || !data.success) {
        console.log('❌ FAIL', t.crop, t.region, data && data.message);
        continue;
      }
      const r = data.data;
      console.log(`✅ ${t.crop} @ ${t.region}: unit=${r.unit}, NPK=${r.recommended.nitrogen}/${r.recommended.phosphorus}/${r.recommended.potassium}`);
    }
  } catch (err) {
    const msg = err && err.response && err.response.data ? JSON.stringify(err.response.data) : (err && err.message) || String(err);
    console.error('❌ Test error:', msg);
    process.exit(1);
  }
}

main();



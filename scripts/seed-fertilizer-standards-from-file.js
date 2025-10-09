const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const FertilizerStandard = require('../models/FertilizerStandard');

async function run() {
  const fileArg = process.argv[2] || 'standards.json';
  const filePath = path.isAbsolute(fileArg) ? fileArg : path.resolve(process.cwd(), fileArg);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/agrisense';
  await mongoose.connect(mongoUri, { dbName: process.env.MONGO_DB || undefined });

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      throw new Error('Input JSON must be an array of FertilizerStandard objects');
    }

    let upserted = 0;
    for (const item of data) {
      const filter = { crop: item.crop, region: item.region, season: item.season || 'All' };
      const update = { ...item };
      await FertilizerStandard.updateOne(filter, { $set: update }, { upsert: true });
      upserted += 1;
    }

    console.log(`✅ Upserted ${upserted} fertilizer standard entries from ${path.basename(filePath)}`);
  } catch (err) {
    console.error('❌ Failed to upsert standards:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();



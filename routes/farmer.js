const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

const CropRecommendation = require('../models/CropRecommendation');
const SoilAnalysis = require('../models/SoilAnalysis');
const FertilizerPlan = require('../models/FertilizerPlan');
const CropProfile = require('../models/CropProfile');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const router = express.Router();

// Crop Recommendation - create
router.post('/crop-recommendations', auth, [
  body('nitrogen').isNumeric(),
  body('phosphorus').isNumeric(),
  body('potassium').isNumeric(),
  body('ph').isFloat({ min: 0, max: 14 }),
  body('rainfall').isNumeric()
], validate, async (req, res) => {
  try {
    const { nitrogen, phosphorus, potassium, ph, rainfall } = req.body;
    const suggested = ['Wheat', 'Rice', 'Maize', 'Soybean', 'Tomato'].sort(() => 0.5 - Math.random()).slice(0, 3);
    const rec = await CropRecommendation.create({
      user: req.user._id,
      nitrogen, phosphorus, potassium, ph, rainfall,
      recommendedCrops: suggested
    });
    res.status(201).json({ success: true, data: rec });
  } catch (e) {
    console.error('Create crop recommendation error:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/crop-recommendations', auth, async (req, res) => {
  const list = await CropRecommendation.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20);
  res.json({ success: true, data: list });
});

// Soil Analysis - create
router.post('/soil-analyses', auth, [
  body('ph').isFloat({ min: 0, max: 14 }),
  body('organicMatter').isNumeric(),
  body('moisture').isNumeric()
], validate, async (req, res) => {
  try {
    const { ph, organicMatter, moisture } = req.body;
    const status = ph >= 6 && ph <= 7 ? 'Healthy' : 'Needs Adjustment';
    const fertilizerSuggestion = status === 'Healthy' ? 'Balanced NPK 10-10-10 at 50kg/acre' : 'Apply agricultural lime and recheck pH';
    const doc = await SoilAnalysis.create({ user: req.user._id, ph, organicMatter, moisture, status, fertilizerSuggestion });
    res.status(201).json({ success: true, data: doc });
  } catch (e) {
    console.error('Create soil analysis error:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/soil-analyses', auth, async (req, res) => {
  const list = await SoilAnalysis.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20);
  res.json({ success: true, data: list });
});

// Fertilizer Plans - create
router.post('/fertilizer-plans', auth, [
  body('areaAcres').isFloat({ min: 0 }),
  body('crop').isString().trim().notEmpty()
], validate, async (req, res) => {
  try {
    const { areaAcres, crop } = req.body;
    const dosageKg = Math.round(40 * Number(areaAcres));
    const plan = await FertilizerPlan.create({ user: req.user._id, areaAcres, crop, dosageKg });
    res.status(201).json({ success: true, data: plan });
  } catch (e) {
    console.error('Create fertilizer plan error:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/fertilizer-plans', auth, async (req, res) => {
  const list = await FertilizerPlan.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20);
  res.json({ success: true, data: list });
});

// Crop Profiles - basic CRUD
router.post('/crop-profiles', auth, [
  body('name').isString().trim().notEmpty(),
], validate, async (req, res) => {
  try {
    const doc = await CropProfile.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ success: true, data: doc });
  } catch (e) {
    console.error('Create crop profile error:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/crop-profiles', auth, async (req, res) => {
  const list = await CropProfile.find({}).sort({ createdAt: -1 }).limit(50);
  res.json({ success: true, data: list });
});

module.exports = router;
// Experts list for farmers to initiate chats
router.get('/experts', auth, async (req, res) => {
  try {
    const User = require('../models/User');
    const experts = await User.find({ role: 'expert', isActive: true, isBlocked: false })
      .sort({ createdAt: -1 })
      .select('name email createdAt');
    res.json({ success: true, data: experts });
  } catch (e) {
    console.error('List experts error:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// AI-based crop recommendation (Gemini)
router.post('/ai/crop-recommendation', auth, [
  body('nitrogen').isNumeric(),
  body('phosphorus').isNumeric(),
  body('potassium').isNumeric(),
  body('ph').isFloat({ min: 0, max: 14 }),
  body('rainfall').isNumeric()
], validate, async (req, res) => {
  try {
    const { nitrogen, phosphorus, potassium, ph, rainfall } = req.body;
    // Deterministic rule-based scoring to avoid random ordering
    // Kerala-focused crop profiles (India, humid tropics). Ranges are indicative.
    const cropProfiles = [
      { name: 'Rice (Paddy)', n: [30, 80], p: [15, 40], k: [50, 110], ph: [5.0, 6.8], rain: [150, 400] },
      { name: 'Banana/Plantain', n: [40, 120], p: [20, 60], k: [80, 180], ph: [5.5, 7.0], rain: [100, 300] },
      { name: 'Coconut', n: [20, 60], p: [10, 40], k: [80, 200], ph: [5.2, 7.8], rain: [100, 350] },
      { name: 'Black Pepper', n: [20, 50], p: [15, 40], k: [40, 100], ph: [5.2, 6.8], rain: [150, 400] },
      { name: 'Rubber', n: [20, 50], p: [10, 35], k: [40, 120], ph: [4.5, 6.5], rain: [150, 350] },
      { name: 'Arecanut', n: [20, 60], p: [15, 40], k: [60, 150], ph: [5.0, 7.0], rain: [150, 350] },
      { name: 'Ginger', n: [30, 80], p: [25, 60], k: [60, 140], ph: [5.5, 6.8], rain: [120, 300] },
      { name: 'Turmeric', n: [30, 80], p: [25, 60], k: [60, 140], ph: [5.5, 7.0], rain: [120, 300] },
      { name: 'Cassava (Tapioca)', n: [10, 40], p: [10, 35], k: [40, 100], ph: [5.0, 7.5], rain: [75, 250] },
      { name: 'Cocoa', n: [20, 60], p: [15, 40], k: [50, 140], ph: [5.0, 6.8], rain: [150, 350] },
      // General field crops still considered but will rank lower under Kerala rain/pH if mismatched
      { name: 'Maize', n: [20, 60], p: [15, 40], k: [40, 80], ph: [5.8, 7.2], rain: [50, 150] },
      { name: 'Soybean', n: [10, 30], p: [15, 35], k: [30, 60], ph: [6.0, 7.5], rain: [60, 150] },
      { name: 'Tomato', n: [20, 50], p: [20, 40], k: [60, 120], ph: [6.0, 7.0], rain: [50, 120] },
    ];

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const rangePenalty = (value, [min, max]) => {
      if (value >= min && value <= max) return 0;
      // Linear penalty outside range relative to range width
      const width = Math.max(1, max - min);
      if (value < min) return (min - value) / width;
      return (value - max) / width;
    };

    const items = cropProfiles.map((c) => {
      const pn = rangePenalty(Number(nitrogen), c.n);
      const pp = rangePenalty(Number(phosphorus), c.p);
      const pk = rangePenalty(Number(potassium), c.k);
      const pph = rangePenalty(Number(ph), c.ph);
      const pr = rangePenalty(Number(rainfall), c.rain);
      // Weighted penalty: emphasize pH and water more
      const totalPenalty = pn * 1 + pp * 1 + pk * 1 + pph * 1.6 + pr * 1.4;
      const raw = clamp(100 - totalPenalty * 30, 0, 100);

      const notes = [];
      if (pph > 0) notes.push(`Adjust soil pH towards ${c.ph[0]}–${c.ph[1]}.`);
      if (pr > 0) notes.push(`Match rainfall near ${c.rain[0]}–${c.rain[1]} mm/month or plan irrigation/drainage.`);
      if (pn > 0) notes.push(`Balance Nitrogen towards ${c.n[0]}–${c.n[1]} mg/kg.`);
      if (pp > 0) notes.push(`Balance Phosphorus towards ${c.p[0]}–${c.p[1]} mg/kg.`);
      if (pk > 0) notes.push(`Balance Potassium towards ${c.k[0]}–${c.k[1]} mg/kg.`);
      if (notes.length === 0) notes.push('Conditions are well-aligned with this crop.');

      return { name: c.name, score: Math.round(raw), notes };
    });

    // Sort deterministically by score desc, then name asc
    items.sort((a, b) => (b.score - a.score) || a.name.localeCompare(b.name));

    let top = items.slice(0, 5);

    // Optionally enrich reasons with Gemini if configured, but keep ranking fixed
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const list = top.map(t => t.name).join(', ');
        const prompt = `Provide one concise agronomy reason (max 16 words) for each crop: ${list} given N=${nitrogen}, P=${phosphorus}, K=${potassium}, pH=${ph}, rainfall=${rainfall} mm/month. Respond as JSON array of strings in the same order.`;
        const r = await model.generateContent(prompt);
        const t = r.response.text();
        const arr = JSON.parse((t.match(/\[.*\]/s) || [t])[0]);
        if (Array.isArray(arr)) {
          top = top.map((it, idx) => ({ ...it, notes: [arr[idx] || it.notes[0]].concat(it.notes.slice(0, 2)) }));
        }
      } catch (_) {
        // ignore enrichment errors, keep deterministic ranking
      }
    }

    return res.json({ success: true, data: top });
  } catch (e) {
    console.error('AI crop recommendation error:', e);
    return res.status(500).json({ success: false, message: 'AI recommendation failed' });
  }
});




const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

const CropRecommendation = require('../models/CropRecommendation');
const SoilAnalysis = require('../models/SoilAnalysis');
const FertilizerPlan = require('../models/FertilizerPlan');
const CropProfile = require('../models/CropProfile');

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




const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

const CropRecommendation = require('../models/CropRecommendation');
const SoilAnalysis = require('../models/SoilAnalysis');
const FertilizerPlan = require('../models/FertilizerPlan');
const CropProfile = require('../models/CropProfile');
const User = require('../models/User');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const router = express.Router();

// Dashboard endpoint
router.get('/dashboard', auth, async (req, res) => {
  try {
    // Get basic stats
    const stats = {
      activeFields: 0, // This would come from a fields model in a real app
      soilTests: await SoilAnalysis.countDocuments({ user: req.user._id }),
      recommendations: await CropRecommendation.countDocuments({ user: req.user._id }),
      irrigationEvents: 0 // This would come from an irrigation model in a real app
    };

    // Get recent recommendations
    const recentRecommendations = await CropRecommendation.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('recommendedCrops createdAt');

    // Get recent activities (simplified for now)
    const recentActivities = [];
    const recentSoilTests = await SoilAnalysis.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('ph status createdAt');
    
    recentSoilTests.forEach(test => {
      recentActivities.push({
        title: `Soil test completed - pH ${test.ph}`,
        time: getTimeAgo(test.createdAt)
      });
    });

    // Get upcoming tasks (placeholder for now)
    const upcomingTasks = [];

    // Get latest soil health data
    const latestSoilTest = await SoilAnalysis.findOne({ user: req.user._id })
      .sort({ createdAt: -1 })
      .select('ph nitrogen phosphorus potassium');

    const soilHealth = {
      ph: latestSoilTest?.ph || null,
      nitrogen: latestSoilTest?.nitrogen || null,
      phosphorus: latestSoilTest?.phosphorus || null,
      potassium: latestSoilTest?.potassium || null
    };

    res.json({
      success: true,
      data: {
        stats,
        recentRecommendations: recentRecommendations.map(rec => 
          rec.recommendedCrops?.[0] || 'No recommendations available'
        ),
        recentActivities,
        upcomingTasks,
        soilHealth
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to load dashboard data' });
  }
});

// Helper function to get time ago
function getTimeAgo(date) {
  const now = new Date();
  const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
  
  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return `${Math.floor(diffInDays / 7)}w ago`;
}

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

// Advanced Soil Analysis endpoint
router.post('/soil-analysis', auth, [
  body('ph').isFloat({ min: 0, max: 14 }),
  body('organicMatter').optional().isFloat({ min: 0, max: 100 }),
  body('moisture').optional().isFloat({ min: 0, max: 100 }),
  body('nitrogen').optional().isFloat({ min: 0 }),
  body('phosphorus').optional().isFloat({ min: 0 }),
  body('potassium').optional().isFloat({ min: 0 }),
  body('soilType').optional().isString(),
  body('location').optional().isString()
], validate, async (req, res) => {
  try {
    const { ph, organicMatter, moisture, nitrogen, phosphorus, potassium, soilType, location } = req.body;
    
    // Determine overall health based on pH and nutrients
    let overallHealth = 'Poor';
    let healthDescription = 'Soil needs significant improvement';
    
    if (ph >= 6 && ph <= 7) {
      if (nitrogen && phosphorus && potassium) {
        // Check if nutrients are in good ranges
        const nGood = nitrogen >= 20 && nitrogen <= 80;
        const pGood = phosphorus >= 15 && phosphorus <= 50;
        const kGood = potassium >= 40 && potassium <= 120;
        
        if (nGood && pGood && kGood) {
          overallHealth = 'Excellent';
          healthDescription = 'All soil parameters are within optimal ranges';
        } else if (nGood || pGood || kGood) {
          overallHealth = 'Good';
          healthDescription = 'Most soil parameters are good with some areas for improvement';
        } else {
          overallHealth = 'Fair';
          healthDescription = 'Soil pH is good but nutrient levels need attention';
        }
      } else {
        overallHealth = 'Good';
        healthDescription = 'Soil pH is optimal, consider nutrient testing for complete analysis';
      }
    } else if (ph >= 5.5 && ph <= 8) {
      overallHealth = 'Fair';
      healthDescription = 'Soil pH is acceptable but could be optimized';
    }

    // Generate recommendations
    const recommendations = [];
    if (ph < 6) {
      recommendations.push('Apply agricultural lime to raise soil pH to 6.0-7.0');
    } else if (ph > 7) {
      recommendations.push('Apply sulfur or acidifying fertilizers to lower soil pH');
    }
    
    if (nitrogen && nitrogen < 20) {
      recommendations.push('Apply nitrogen-rich fertilizers or organic matter');
    }
    if (phosphorus && phosphorus < 15) {
      recommendations.push('Apply phosphorus fertilizers or bone meal');
    }
    if (potassium && potassium < 40) {
      recommendations.push('Apply potassium fertilizers or wood ash');
    }
    
    if (organicMatter && organicMatter < 2) {
      recommendations.push('Add compost or organic matter to improve soil structure');
    }
    
    if (moisture && moisture < 20) {
      recommendations.push('Improve irrigation or add mulch to retain moisture');
    }

    // Fertilizer recommendations
    let fertilizerRecommendations = '';
    if (overallHealth === 'Excellent') {
      fertilizerRecommendations = 'Maintain current soil conditions with balanced NPK 10-10-10 at 30kg/acre';
    } else if (overallHealth === 'Good') {
      fertilizerRecommendations = 'Apply balanced NPK 12-12-12 at 40kg/acre with soil amendments';
    } else {
      fertilizerRecommendations = 'Apply targeted fertilizers based on soil test results and consider soil conditioning';
    }

    // Crop suitability based on soil conditions
    const cropSuitability = [];
    if (ph >= 6 && ph <= 7) {
      cropSuitability.push('Wheat', 'Rice', 'Maize', 'Tomato', 'Potato');
    } else if (ph >= 5.5 && ph <= 6.5) {
      cropSuitability.push('Potato', 'Blueberry', 'Raspberry');
    } else if (ph >= 6.5 && ph <= 7.5) {
      cropSuitability.push('Wheat', 'Barley', 'Alfalfa');
    }

    const analysis = {
      overallHealth,
      healthDescription,
      recommendations,
      fertilizerRecommendations,
      cropSuitability
    };

    // Save to database
    const doc = await SoilAnalysis.create({ 
      user: req.user._id, 
      ph, 
      organicMatter, 
      moisture, 
      nitrogen,
      phosphorus,
      potassium,
      soilType,
      location,
      status: overallHealth,
      fertilizerSuggestion: fertilizerRecommendations,
      analysis
    });

    res.status(201).json({ success: true, data: analysis });
  } catch (e) {
    console.error('Advanced soil analysis error:', e);
    res.status(500).json({ success: false, message: 'Soil analysis failed' });
  }
});

router.get('/soil-analyses', auth, async (req, res) => {
  const list = await SoilAnalysis.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20);
  res.json({ success: true, data: list });
});

// Fertilizer Calculator endpoint
router.post('/fertilizer-calculator', auth, [
  body('area').isFloat({ min: 0 }),
  body('crop').isString().trim().notEmpty(),
  body('soilType').optional().isString(),
  body('ph').optional().isFloat({ min: 0, max: 14 }),
  body('nitrogen').optional().isFloat({ min: 0 }),
  body('phosphorus').optional().isFloat({ min: 0 }),
  body('potassium').optional().isFloat({ min: 0 })
], validate, async (req, res) => {
  try {
    const { area, crop, soilType, ph, nitrogen, phosphorus, potassium } = req.body;
    
    // Base fertilizer rates per acre for different crops
    const cropRates = {
      'wheat': { npk: 120, nitrogen: 60, phosphorus: 30, potassium: 30 },
      'rice': { npk: 100, nitrogen: 50, phosphorus: 25, potassium: 25 },
      'maize': { npk: 140, nitrogen: 70, phosphorus: 35, potassium: 35 },
      'sugarcane': { npk: 200, nitrogen: 100, phosphorus: 50, potassium: 50 },
      'cotton': { npk: 160, nitrogen: 80, phosphorus: 40, potassium: 40 },
      'potato': { npk: 180, nitrogen: 90, phosphorus: 45, potassium: 45 },
      'tomato': { npk: 150, nitrogen: 75, phosphorus: 37, potassium: 38 },
      'onion': { npk: 120, nitrogen: 60, phosphorus: 30, potassium: 30 },
      'other': { npk: 100, nitrogen: 50, phosphorus: 25, potassium: 25 }
    };

    const cropKey = crop.toLowerCase();
    const rates = cropRates[cropKey] || cropRates['other'];
    
    // Calculate base amounts
    let totalAmount = Math.round(rates.npk * area);
    let nitrogenAmount = Math.round(rates.nitrogen * area);
    let phosphorusAmount = Math.round(rates.phosphorus * area);
    let potassiumAmount = Math.round(rates.potassium * area);

    // Adjust based on soil analysis if provided
    if (ph && nitrogen && phosphorus && potassium) {
      // pH adjustments
      if (ph < 6) {
        totalAmount = Math.round(totalAmount * 1.2); // Increase for acidic soil
      } else if (ph > 7.5) {
        totalAmount = Math.round(totalAmount * 0.9); // Decrease for alkaline soil
      }

      // Nutrient-specific adjustments
      if (nitrogen < 20) {
        nitrogenAmount = Math.round(nitrogenAmount * 1.3);
      } else if (nitrogen > 60) {
        nitrogenAmount = Math.round(nitrogenAmount * 0.7);
      }

      if (phosphorus < 15) {
        phosphorusAmount = Math.round(phosphorusAmount * 1.4);
      } else if (phosphorus > 40) {
        phosphorusAmount = Math.round(phosphorusAmount * 0.6);
      }

      if (potassium < 40) {
        potassiumAmount = Math.round(potassiumAmount * 1.3);
      } else if (potassium > 100) {
        potassiumAmount = Math.round(potassiumAmount * 0.7);
      }

      totalAmount = nitrogenAmount + phosphorusAmount + potassiumAmount;
    }

    // Soil type adjustments
    if (soilType) {
      switch (soilType.toLowerCase()) {
        case 'sandy':
          totalAmount = Math.round(totalAmount * 1.1); // Sandy soils need more
          break;
        case 'clay':
          totalAmount = Math.round(totalAmount * 0.9); // Clay soils retain nutrients better
          break;
        case 'loamy':
          // No adjustment needed for loamy soil
          break;
      }
    }

    const breakdown = {
      nitrogen: nitrogenAmount,
      phosphorus: phosphorusAmount,
      potassium: potassiumAmount
    };

    let notes = `Recommended for ${crop} on ${area} acres`;
    if (soilType) {
      notes += ` in ${soilType} soil`;
    }
    if (ph) {
      notes += ` with pH ${ph}`;
    }

    const dosage = {
      totalAmount,
      breakdown,
      notes,
      crop,
      area,
      soilType: soilType || 'Not specified'
    };

    // Save to database
    const plan = await FertilizerPlan.create({ 
      user: req.user._id, 
      areaAcres: area, 
      crop, 
      dosageKg: totalAmount,
      breakdown,
      notes
    });

    res.status(201).json({ success: true, data: dosage });
  } catch (e) {
    console.error('Fertilizer calculator error:', e);
    res.status(500).json({ success: false, message: 'Fertilizer calculation failed' });
  }
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

// Reports endpoints
router.get('/reports', auth, async (req, res) => {
  try {
    // For now, return empty array - in a real app, this would fetch from a reports collection
    res.json({ success: true, data: [] });
  } catch (e) {
    console.error('Get reports error:', e);
    res.status(500).json({ success: false, message: 'Failed to load reports' });
  }
});

router.post('/reports/generate', auth, [
  body('type').isIn(['summary', 'soil', 'crops'])
], validate, async (req, res) => {
  try {
    const { type } = req.body;
    const userId = req.user._id;
    
    // Generate a simple report based on type
    let reportData = {};
    let reportName = '';
    
    switch (type) {
      case 'summary':
        reportName = `Farm Summary Report - ${new Date().toLocaleDateString()}`;
        reportData = {
          farmer: req.user.name,
          email: req.user.email,
          generatedAt: new Date(),
          stats: {
            soilTests: await SoilAnalysis.countDocuments({ user: userId }),
            recommendations: await CropRecommendation.countDocuments({ user: userId }),
            fertilizerPlans: await FertilizerPlan.countDocuments({ user: userId })
          }
        };
        break;
        
      case 'soil':
        reportName = `Soil Analysis Report - ${new Date().toLocaleDateString()}`;
        const soilTests = await SoilAnalysis.find({ user: userId })
          .sort({ createdAt: -1 })
          .limit(10)
          .select('ph organicMatter moisture status createdAt');
        reportData = {
          farmer: req.user.name,
          generatedAt: new Date(),
          soilTests
        };
        break;
        
      case 'crops':
        reportName = `Crop Recommendations Report - ${new Date().toLocaleDateString()}`;
        const recommendations = await CropRecommendation.find({ user: userId })
          .sort({ createdAt: -1 })
          .limit(10)
          .select('recommendedCrops nitrogen phosphorus potassium ph rainfall createdAt');
        reportData = {
          farmer: req.user.name,
          generatedAt: new Date(),
          recommendations
        };
        break;
    }
    
    // In a real app, you would generate a PDF here
    // For now, we'll return the data as JSON
    res.json({ 
      success: true, 
      data: {
        id: `report_${Date.now()}`,
        name: reportName,
        type,
        createdAt: new Date(),
        data: reportData
      }
    });
  } catch (e) {
    console.error('Generate report error:', e);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
});

// Experts list for farmers to initiate chats
router.get('/experts', auth, async (req, res) => {
  try {
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

module.exports = router;

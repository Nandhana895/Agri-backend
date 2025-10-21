const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

const CropRecommendation = require('../models/CropRecommendation');
const SoilAnalysis = require('../models/SoilAnalysis');
const FertilizerPlan = require('../models/FertilizerPlan');
const CropProfile = require('../models/CropProfile');
const CropCalendar = require('../models/CropCalendar');
const User = require('../models/User');
const ActionLog = require('../models/ActionLog');
const FarmLog = require('../models/FarmLog');
const Field = require('../models/Field');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});
const pdfParse = require('pdf-parse');
const Scheme = require('../models/Scheme');

// Rate limiting for sowing calendar endpoint
const sowingCalendarRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests for sowing calendar. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Dashboard endpoint
router.get('/dashboard', auth, async (req, res) => {
  try {
    // Get field statistics
    const fieldStats = await Field.getFieldStats(req.user._id);
    
    // Get basic stats
    const stats = {
      activeFields: fieldStats.activeFields,
      totalFields: fieldStats.totalFields,
      totalArea: fieldStats.totalArea,
      fieldsWithCrops: fieldStats.fieldsWithCrops,
      soilTests: await SoilAnalysis.countDocuments({ user: req.user._id }),
      recommendations: await CropRecommendation.countDocuments({ user: req.user._id }),
      farmLogs: await FarmLog.countDocuments({ farmerId: req.user._id })
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

// Generate PDF report for fertilizer plan
router.post('/fertilizer-pdf', auth, [
  body('crop').isString().trim().notEmpty(),
  body('region').isString().trim().notEmpty(),
  body('landSize').isString().trim().notEmpty(),
  body('fertilizer').isObject(),
  body('recommended').isObject(),
  body('unit').isString(),
  body('splitDoses').optional().isArray(),
  body('tips').optional().isArray(),
  body('organicAdvice').optional().isString()
], validate, async (req, res) => {
  try {
    const { crop, region, landSize, fertilizer, recommended, unit, splitDoses, tips, organicAdvice } = req.body;
    
    // Create a simple HTML report
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Fertilizer Plan - ${crop}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; border-bottom: 2px solid #22c55e; padding-bottom: 20px; margin-bottom: 30px; }
          .section { margin: 20px 0; }
          .section h3 { color: #22c55e; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
          .fertilizer-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
          .fertilizer-item { text-align: center; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px; }
          .fertilizer-item h4 { margin: 0 0 10px 0; color: #374151; }
          .fertilizer-item .amount { font-size: 24px; font-weight: bold; color: #22c55e; }
          .split-dose { margin: 10px 0; padding: 10px; background: #f9fafb; border-radius: 5px; }
          .tip { margin: 5px 0; padding-left: 20px; }
          .footer { margin-top: 40px; text-align: center; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🌾 Fertilizer Plan Report</h1>
          <h2>${crop} - ${region}</h2>
          <p>Land Size: ${landSize}</p>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
        </div>
        
        <div class="section">
          <h3>📊 Fertilizer Recommendations</h3>
          <div class="fertilizer-grid">
            <div class="fertilizer-item">
              <h4>Urea</h4>
              <div class="amount">${fertilizer.urea} ${unit}</div>
            </div>
            <div class="fertilizer-item">
              <h4>DAP</h4>
              <div class="amount">${fertilizer.dap} ${unit}</div>
            </div>
            <div class="fertilizer-item">
              <h4>MOP</h4>
              <div class="amount">${fertilizer.mop} ${unit}</div>
            </div>
          </div>
        </div>
        
        <div class="section">
          <h3>🧪 Nutrient Requirements</h3>
          <div class="fertilizer-grid">
            <div class="fertilizer-item">
              <h4>Nitrogen</h4>
              <div class="amount">${recommended.nitrogen} ${unit}</div>
            </div>
            <div class="fertilizer-item">
              <h4>Phosphorus</h4>
              <div class="amount">${recommended.phosphorus} ${unit}</div>
            </div>
            <div class="fertilizer-item">
              <h4>Potassium</h4>
              <div class="amount">${recommended.potassium} ${unit}</div>
            </div>
          </div>
        </div>
        
        ${splitDoses && splitDoses.length > 0 ? `
        <div class="section">
          <h3>📅 Split Dose Schedule</h3>
          ${splitDoses.map(dose => `
            <div class="split-dose">
              <strong>${dose.stage}</strong> - ${dose.timing || ''}
              <br>
              ${dose.urea > 0 ? `Urea: ${dose.urea}${unit}` : ''}
              ${dose.dap > 0 ? `DAP: ${dose.dap}${unit}` : ''}
              ${dose.mop > 0 ? `MOP: ${dose.mop}${unit}` : ''}
              ${dose.notes ? `<br><em>${dose.notes}</em>` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}
        
        ${tips && tips.length > 0 ? `
        <div class="section">
          <h3>💡 Crop-Specific Tips</h3>
          ${tips.map(tip => `<div class="tip">• ${tip}</div>`).join('')}
        </div>
        ` : ''}
        
        ${organicAdvice ? `
        <div class="section">
          <h3>🌱 Organic Alternatives</h3>
          <p>${organicAdvice}</p>
        </div>
        ` : ''}
        
        <div class="footer">
          <p>Generated by AgriSense Farmer Dashboard</p>
          <p>For best results, consult with local agricultural extension officer</p>
        </div>
      </body>
      </html>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="fertilizer-plan-${crop.toLowerCase()}-${Date.now()}.html"`);
    res.send(html);
  } catch (e) {
    console.error('PDF generation error:', e);
    res.status(500).json({ success: false, message: 'Failed to generate PDF report' });
  }
});

// Get available crops and regions for fertilizer calculator
router.get('/fertilizer-options', auth, async (req, res) => {
  try {
    const FertilizerStandard = require('../models/FertilizerStandard');
    
    const crops = await FertilizerStandard.distinct('crop');
    const regions = await FertilizerStandard.distinct('region');

    // Sensible defaults if DB has not been seeded yet
    const defaultCrops = [
      'Rice', 'Wheat', 'Maize', 'Tomato', 'Potato', 'Onion', 'Sugarcane', 'Cotton', 'Arecanut', 'Banana'
    ];
    const defaultRegions = [
      'Kerala', 'Tamil Nadu', 'Karnataka', 'Andhra Pradesh', 'Telangana', 'Maharashtra', 'Gujarat', 'Rajasthan',
      'Madhya Pradesh', 'Uttar Pradesh', 'Bihar', 'West Bengal', 'Odisha', 'Punjab', 'Haryana', 'Assam', 'All'
    ];

    const outCrops = (Array.isArray(crops) && crops.length > 0 ? crops : defaultCrops).sort();
    const outRegions = (Array.isArray(regions) && regions.length > 0 ? regions : defaultRegions).sort();

    res.json({
      success: true,
      data: {
        crops: outCrops,
        regions: outRegions
      }
    });
  } catch (e) {
    console.error('Get fertilizer options error:', e);
    res.status(500).json({ success: false, message: 'Failed to fetch options' });
  }
});

// Get farmer's recent soil analyses for auto-fill
router.get('/recent-soil-analyses', auth, async (req, res) => {
  try {
    const SoilAnalysis = require('../models/SoilAnalysis');
    
    const analyses = await SoilAnalysis.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('_id ph organicMatter nitrogen phosphorus potassium soilType location createdAt');
    
    res.json({
      success: true,
      data: analyses
    });
  } catch (e) {
    console.error('Get recent soil analyses error:', e);
    res.status(500).json({ success: false, message: 'Failed to fetch soil analyses' });
  }
});

// Enhanced Fertilizer Calculator endpoint
router.post('/fertilizer-calculator', auth, [
  body('crop').isString().trim().notEmpty(),
  body('region').isString().trim().notEmpty(),
  body('landSize').isFloat({ min: 0.001 }),
  body('landUnit').isIn(['acre', 'hectare', 'sqm']),
  body('soilType').optional().isString(),
  body('organicCarbon').optional().isFloat({ min: 0, max: 10 }),
  body('soilN').optional().isIn(['low', 'medium', 'high']),
  body('soilP').optional().isIn(['low', 'medium', 'high']),
  body('soilK').optional().isIn(['low', 'medium', 'high']),
  body('fromSoilAnalysisId').optional().isMongoId()
], validate, async (req, res) => {
  try {
    const { 
      crop, 
      region, 
      landSize, 
      landUnit, 
      soilType, 
      organicCarbon, 
      soilN, 
      soilP, 
      soilK, 
      fromSoilAnalysisId 
    } = req.body;

    // Convert land units to hectares for calculation
    let areaInHa;
    switch (landUnit) {
      case 'acre':
        areaInHa = landSize * 0.4047;
        break;
      case 'hectare':
        areaInHa = landSize;
        break;
      case 'sqm':
        areaInHa = landSize / 10000;
        break;
      default:
        areaInHa = landSize * 0.4047; // Default to acres
    }

    // Find fertilizer standard for the crop and region
    const FertilizerStandard = require('../models/FertilizerStandard');
    let standard = await FertilizerStandard.findOne({
      crop: { $regex: new RegExp(crop, 'i') },
      region: { $regex: new RegExp(region, 'i') }
    });

    // Fallback to general standards if region-specific not found
    if (!standard) {
      standard = await FertilizerStandard.findOne({
        crop: { $regex: new RegExp(crop, 'i') },
        region: 'All'
      });
    }

    // Final fallback: use any available standard for the crop (most recent), regardless of region
    // This ensures users always get a result even if their specific state isn't in the DB
    if (!standard) {
      standard = await FertilizerStandard.findOne({
        crop: { $regex: new RegExp(crop, 'i') }
      }).sort({ lastUpdated: -1 });
    }

    if (!standard) {
      return res.status(404).json({
        success: false,
        message: `Fertilizer data unavailable for ${crop} in ${region}. Please contact Agri Officer.`
      });
    }

    // Auto-fetch soil analysis data if provided
    let soilData = {};
    if (fromSoilAnalysisId) {
      const SoilAnalysis = require('../models/SoilAnalysis');
      const soilAnalysis = await SoilAnalysis.findOne({
        _id: fromSoilAnalysisId,
        user: req.user._id
      });
      
      if (soilAnalysis) {
        soilData = {
          organicCarbon: soilAnalysis.organicMatter || organicCarbon,
          soilN: soilAnalysis.nitrogen ? 
            (soilAnalysis.nitrogen < 20 ? 'low' : soilAnalysis.nitrogen > 60 ? 'high' : 'medium') : soilN,
          soilP: soilAnalysis.phosphorus ? 
            (soilAnalysis.phosphorus < 15 ? 'low' : soilAnalysis.phosphorus > 40 ? 'high' : 'medium') : soilP,
          soilK: soilAnalysis.potassium ? 
            (soilAnalysis.potassium < 40 ? 'low' : soilAnalysis.potassium > 100 ? 'high' : 'medium') : soilK
        };
      }
    }

    // Calculate base nutrient requirements
    let nitrogenPerHa = standard.nitrogenPerHa;
    let phosphorusPerHa = standard.phosphorusPerHa;
    let potassiumPerHa = standard.potassiumPerHa;

    // Apply soil type adjustments from standards when available
    if (soilType && standard.soilAdjustments[soilType.toLowerCase()]) {
      const adjustment = standard.soilAdjustments[soilType.toLowerCase()];
      nitrogenPerHa *= adjustment.nitrogen;
      phosphorusPerHa *= adjustment.phosphorus;
      potassiumPerHa *= adjustment.potassium;
    }

    // Additional explicit nitrogen adjustments for realism
    // Sandy soil → +10% N, Clay → -5% N (applied in addition to any standard multipliers)
    if (soilType) {
      const st = soilType.toLowerCase();
      if (st === 'sandy') {
        nitrogenPerHa *= 1.10;
      } else if (st === 'clay' || st === 'clayey') {
        nitrogenPerHa *= 0.95;
      }
    }

    // Apply organic matter adjustments from standards
    const organicLevel = soilData.organicCarbon || organicCarbon;
    if (organicLevel !== undefined) {
      let organicAdjustment;
      if (organicLevel < 1) {
        organicAdjustment = standard.organicMatterAdjustments.low;
      } else if (organicLevel > 3) {
        organicAdjustment = standard.organicMatterAdjustments.high;
      } else {
        organicAdjustment = standard.organicMatterAdjustments.medium;
      }
      nitrogenPerHa *= organicAdjustment.nitrogen;
      phosphorusPerHa *= organicAdjustment.phosphorus;
      potassiumPerHa *= organicAdjustment.potassium;

      // If organic carbon > 1% → reduce N by additional 10%
      if (organicLevel > 1) {
        nitrogenPerHa *= 0.90;
      }
    }

    // Apply soil nutrient level adjustments
    if (soilData.soilN || soilN) {
      const level = soilData.soilN || soilN;
      if (level === 'low') nitrogenPerHa *= 1.3;
      else if (level === 'high') nitrogenPerHa *= 0.7;
    }

    if (soilData.soilP || soilP) {
      const level = soilData.soilP || soilP;
      if (level === 'low') phosphorusPerHa *= 1.4;
      else if (level === 'high') phosphorusPerHa *= 0.6;
    }

    if (soilData.soilK || soilK) {
      const level = soilData.soilK || soilK;
      if (level === 'low') potassiumPerHa *= 1.3;
      else if (level === 'high') potassiumPerHa *= 0.7;
    }

    // Calculate total nutrient requirements for the area
    const totalNitrogen = nitrogenPerHa * areaInHa;
    const totalPhosphorus = phosphorusPerHa * areaInHa;
    const totalPotassium = potassiumPerHa * areaInHa;

    // Convert nutrients to fertilizer equivalents
    // Urea = 46% N, DAP = 18% N + 46% P, MOP = 60% K
    const ureaRequired = totalNitrogen / 0.46;
    const dapRequired = totalPhosphorus / 0.46; // DAP provides P
    const mopRequired = totalPotassium / 0.60;

    // Adjust urea for DAP's nitrogen contribution
    const nitrogenFromDap = dapRequired * 0.18;
    const adjustedUrea = Math.max(0, ureaRequired - nitrogenFromDap);

    // Determine unit: grams for small areas; also avoid displaying "0 kg"
    let isSmallArea = areaInHa < 0.08; // Less than 0.2 acres → grams
    let unit = isSmallArea ? 'g' : 'kg';
    // If area considered large but totals are very small, fallback to grams to avoid "0 kg"
    // Threshold: any fertilizer or nutrient < 0.1 kg → use grams for display
    const wouldBeSmallKg = (!isSmallArea) && (
      totalNitrogen < 0.1 || totalPhosphorus < 0.1 || totalPotassium < 0.1 ||
      adjustedUrea < 0.1 || dapRequired < 0.1 || mopRequired < 0.1
    );
    if (wouldBeSmallKg) {
      isSmallArea = true;
      unit = 'g';
    }
    const multiplier = isSmallArea ? 1000 : 1;

    // Calculate split doses
    const splitDoses = standard.splitDoses.map(dose => ({
      stage: dose.stage,
      urea: Math.round((adjustedUrea * dose.nitrogenPercent / 100) * multiplier),
      dap: Math.round((dapRequired * dose.phosphorusPercent / 100) * multiplier),
      mop: Math.round((mopRequired * dose.potassiumPercent / 100) * multiplier),
      timing: dose.timing,
      notes: dose.notes
    }));

    // Generate organic advice
    let organicAdvice = '';
    if (standard.organicAdvice.compost) {
      const compostAmount = isSmallArea ? 
        `${Math.round(parseFloat(standard.organicAdvice.compost.amount.split('-')[0]) * areaInHa * 1000)}g` :
        `${Math.round(parseFloat(standard.organicAdvice.compost.amount.split('-')[0]) * areaInHa)}kg`;
      organicAdvice += `Add ${compostAmount} compost ${standard.organicAdvice.compost.timing}. `;
    }

    // Prepare result
    const result = {
      crop: standard.crop,
      region: standard.region,
      landSize: `${landSize} ${landUnit}`,
      recommended: {
        nitrogen: Math.round(totalNitrogen * multiplier),
        phosphorus: Math.round(totalPhosphorus * multiplier),
        potassium: Math.round(totalPotassium * multiplier)
      },
      fertilizer: {
        urea: Math.round(adjustedUrea * multiplier),
        dap: Math.round(dapRequired * multiplier),
        mop: Math.round(mopRequired * multiplier)
      },
      unit,
      splitDoses,
      tips: standard.tips,
      organicAdvice: organicAdvice.trim(),
      message: `${standard.region?.toLowerCase() === String(region).toLowerCase() ?
        `Calculated using ${standard.region} region fertilizer standards (${standard.source}).` :
        `Region-specific data for ${crop} in ${region} was not found. Using ${standard.region} standards (${standard.source}).`}`
    };

    // Save to database
    const FertilizerPlan = require('../models/FertilizerPlan');
    const plan = await FertilizerPlan.create({
      user: req.user._id,
      areaAcres: landSize,
      areaUnit: landUnit,
      crop: standard.crop,
      region: standard.region,
      soilType,
      organicCarbon: soilData.organicCarbon || organicCarbon,
      soilN: soilData.soilN || soilN,
      soilP: soilData.soilP || soilP,
      soilK: soilData.soilK || soilK,
      fromSoilAnalysisId,
      recommended: result.recommended,
      fertilizer: result.fertilizer,
      unit: result.unit,
      splitDoses: result.splitDoses,
      tips: result.tips,
      organicAdvice: result.organicAdvice,
      message: result.message,
      // Legacy fields
      dosageKg: Math.round((adjustedUrea + dapRequired + mopRequired) * multiplier / 1000),
      breakdown: {
        nitrogen: result.recommended.nitrogen,
        phosphorus: result.recommended.phosphorus,
        potassium: result.recommended.potassium
      },
      notes: result.message
    });

    res.status(201).json({ success: true, data: result });
  } catch (e) {
    console.error('Enhanced fertilizer calculator error:', e);
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
  body('type').isIn(['summary', 'soil', 'crops', 'sowing_calendar'])
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
      case 'sowing_calendar':
        reportName = `Sowing Calendar - ${new Date().toLocaleDateString()}`;
        reportData = {
          farmer: req.user.name,
          generatedAt: new Date(),
          ...(req.body?.data || {})
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

// Farm Logbook: store simple log entries (uses ActionLog as storage)
router.post('/log', auth, async (req, res) => {
  try {
    const entry = await ActionLog.create({
      actor: req.user._id,
      action: 'logbook_add',
      targetType: req.body?.type || 'log',
      targetId: '',
      meta: { ...(req.body || {}) }
    });
    return res.status(201).json({ success: true, id: entry._id });
  } catch (e) {
    console.error('Add to logbook error:', e);
    return res.status(500).json({ success: false, message: 'Failed to add to logbook' });
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

// Weather: proxy to external provider and normalize response
router.get('/weather', auth, async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!isFinite(lat) || !isFinite(lon)) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude are required' });
    }

    const openWeatherKey = process.env.OPENWEATHER_API_KEY || process.env.OPEN_WEATHER_API_KEY || '';

    // Attempt OpenWeather first if key available
    let current = null;
    try {
      if (openWeatherKey) {
        const { data } = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
          params: { lat, lon, appid: openWeatherKey, units: 'metric' },
          timeout: 12000
        });
        current = {
          temperature: Math.round(Number(data.main?.temp) || 0),
          humidity: Number(data.main?.humidity) || undefined,
          rainfall: data.rain?.['1h'] ? `${data.rain['1h']} mm` : '—',
          wind: Math.round((Number(data.wind?.speed) || 0) * 3.6), // m/s -> km/h
          description: data.weather?.[0]?.description || '—',
          icon: data.weather?.[0]?.icon || '01d'
        };
      }
    } catch (_) {
      current = null; // fallback below
    }

    // Fallback to Open-Meteo
    if (!current) {
      const { data } = await axios.get('https://api.open-meteo.com/v1/forecast', {
        params: {
          latitude: lat,
          longitude: lon,
          current: 'temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,wind_direction_10m,weather_code',
          hourly: 'temperature_2m,precipitation_probability,weather_code',
          wind_speed_unit: 'kmh'
        },
        timeout: 12000
      });
      const c = data.current || {};
      const codeText = (code => {
        const m = {
          0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
          45: 'Fog', 48: 'Depositing rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
          61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain', 71: 'Slight snow fall', 73: 'Moderate snow fall', 75: 'Heavy snow fall',
          80: 'Rain showers', 81: 'Rain showers', 82: 'Heavy rain showers', 95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Severe thunderstorm'
        }; return m[code] || 'Unknown';
      })(c.weather_code);
      current = {
        temperature: Math.round(Number(c.temperature_2m) || 0),
        humidity: Number(c.relative_humidity_2m) || undefined,
        rainfall: '—',
        wind: Math.round(Number(c.wind_speed_10m) || 0),
        description: codeText,
        icon: '01d'
      };
    }

    // Build a lightweight 5-day forecast placeholder using current as baseline
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const today = new Date();
    const forecast = Array.from({ length: 5 }).map((_, i) => {
      const d = new Date(today.getTime());
      d.setDate(today.getDate() + i);
      const temp = Math.max(-10, Math.min(45, current.temperature + (i === 0 ? 0 : (i % 2 ? 1 : -1) * 2)));
      return {
        day: days[d.getDay()],
        temp,
        tempMin: Math.max(-15, temp - 3),
        rain: i % 2 === 0 ? '—' : '20%'
          ,
        description: current.description,
        icon: current.icon
      };
    });

    return res.json({
      success: true,
      current,
      location: { lat, lon },
      forecast,
      alerts: [],
      recommendations: []
    });
  } catch (e) {
    console.error('Weather endpoint error:', e?.response?.data || e.message || e);
    return res.status(502).json({ success: false, message: 'Weather provider failed. Please try again.' });
  }
});

// Sowing Calendar endpoint with sophisticated matching logic
router.get('/sowing-calendar', auth, sowingCalendarRateLimit, async (req, res) => {
  try {
    const { crop, region: regionParam, season, list } = req.query;

    // Support listing crops for dropdowns
    if (String(list) === 'true') {
      try {
        const regionForList = regionParam || req.user?.region || null;
        const listQuery = {};
        if (regionForList && regionForList !== 'all') {
          listQuery.$or = [{ region: regionForList }, { region: 'all' }];
        }
        const crops = await CropCalendar.distinct('crop', listQuery);
        return res.json({ success: true, crops: Array.isArray(crops) ? crops.sort() : [] });
      } catch (_) {
        return res.json({ success: true, crops: [] });
      }
    }

    // Validate required parameters
    if (!crop) {
      return res.status(400).json({
        success: false,
        message: 'Crop parameter is required. Please specify the crop name.'
      });
    }

    // Normalize crop name (lowercase)
    const normalizedCrop = crop.toLowerCase().trim();
    
    // Build base query with crop matching
    let query = {
      crop_lower: { $regex: normalizedCrop, $options: 'i' }
    };

    // Add season filter if provided
    if (season) {
      const validSeasons = ['Kharif', 'Rabi', 'Zaid'];
      if (!validSeasons.includes(season)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid season. Must be one of: Kharif, Rabi, Zaid'
        });
      }
      query.season = season;
    }

    // Determine region using param or user profile
    const region = regionParam || req.user?.region || undefined;

    // Priority-based matching logic
    let results = [];
    let matchExplanation = '';

    if (region) {
      // Priority 1: Exact crop + region match
      const exactRegionMatch = await CropCalendar.find({
        ...query,
        region: region
      }).sort({ lastUpdated: -1 });

      if (exactRegionMatch.length > 0) {
        results = exactRegionMatch;
        matchExplanation = `Found ${exactRegionMatch.length} exact match(es) for "${crop}" in region "${region}"`;
      } else {
        // Priority 2: Crop + agroZone match (if user's agroZone is known)
        // For now, we'll try common agroZones
        const commonAgroZones = ['humid', 'arid', 'temperate', 'semi-arid'];
        let agroZoneMatch = [];
        
        for (const zone of commonAgroZones) {
          const zoneResults = await CropCalendar.find({
            ...query,
            agroZone: zone
          }).sort({ lastUpdated: -1 });
          
          if (zoneResults.length > 0) {
            agroZoneMatch = zoneResults;
            matchExplanation = `Found ${zoneResults.length} match(es) for "${crop}" in agro-zone "${zone}" (region-specific data not available)`;
            break;
          }
        }

        if (agroZoneMatch.length > 0) {
          results = agroZoneMatch;
        } else {
          // Priority 3: Fallback to crop + region: "all" or general records
          const fallbackMatch = await CropCalendar.find({
            ...query,
            $or: [
              { region: 'all' },
              { region: { $exists: false } }
            ]
          }).sort({ lastUpdated: -1 });

          if (fallbackMatch.length > 0) {
            results = fallbackMatch;
            matchExplanation = `Found ${fallbackMatch.length} general match(es) for "${crop}" (no region-specific data available)`;
          }
        }
      }
    } else {
      // No region specified - get all matches for the crop
      results = await CropCalendar.find(query).sort({ lastUpdated: -1 });
      matchExplanation = `Found ${results.length} match(es) for "${crop}" across all regions`;
    }

    // If no results found
    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No calendar found for this crop in your region. Please contact local agri-office.'
      });
    }

    // Format response data
    const formattedResults = results.map(record => ({
      crop: record.crop,
      season: record.season,
      startMonth: record.startMonth,
      endMonth: record.endMonth,
      region: record.region,
      agroZone: record.agroZone,
      varieties: record.varieties || [],
      notes: record.notes || '',
      source: record.source || '',
      lastUpdated: record.lastUpdated
    }));

    // Add match explanation to response
    const response = {
      results: formattedResults,
      matchExplanation,
      totalMatches: formattedResults.length
    };

    res.json(response);

  } catch (error) {
    console.error('Sowing calendar error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sowing calendar data. Please try again later.'
    });
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

// OCR PDF -> Summary
router.post('/ocr/pdf-summary', auth, uploadMemory.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const mime = req.file.mimetype || '';
    if (mime !== 'application/pdf') {
      return res.status(400).json({ success: false, message: 'Only PDF files are supported' });
    }

    // First-pass: try local text extraction (works for many digital PDFs)
    let text = '';
    try {
      const parsed = await pdfParse(req.file.buffer);
      text = String(parsed.text || '').trim();
    } catch (_) {
      text = '';
    }

    // Fallback to OCR API only if needed
    if (!text) {
      const apiKey = process.env.OCR_API_KEY || 'K81457044988957';
      const base64 = `data:application/pdf;base64,${req.file.buffer.toString('base64')}`;

      const params = new URLSearchParams();
      params.append('base64Image', base64);
      params.append('language', 'eng');
      params.append('isOverlayRequired', 'false');
      params.append('OCREngine', '2');

      const { data } = await axios.post('https://api.ocr.space/parse/image', params, {
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 90000
      });

      if (!data || data.IsErroredOnProcessing) {
        const msg = data?.ErrorMessage || data?.ErrorDetails || 'OCR processing failed';
        return res.status(502).json({ success: false, message: Array.isArray(msg) ? msg.join(', ') : msg });
      }

      const ocrParsed = Array.isArray(data.ParsedResults) ? data.ParsedResults : [];
      text = String(ocrParsed[0]?.ParsedText || '').trim();
    }
    if (!text) {
      return res.status(200).json({ success: true, summary: 'No recognizable text found in the PDF.', text: '' });
    }

    // Sentence segmentation and normalization
    const sentences = text
      .replace(/\r/g, ' ')
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && /[a-zA-Z]/.test(s));

    // Keep uniqueness cap to reduce verbosity
    const unique = [];
    const seen = new Set();
    for (const s of sentences) {
      const k = s.toLowerCase().replace(/[^a-z0-9\s]/g, '').slice(0, 140);
      if (!seen.has(k)) { seen.add(k); unique.push(s); }
      if (unique.length >= 60) break;
    }

    // Keywords that matter for soil reports
    const keywords = ['ph', 'nitrogen', 'phosphorus', 'potassium', 'organic', 'moisture', 'recommend', 'apply', 'dose', 'result', 'conclusion', 'summary', 'soil', 'nutrient', 'deficien', 'excess', 'kg', 'ppm', 'mg'];

    // Score sentences: prefer keyword presence, medium length, contains numbers, avoids boilerplate
    const scoreSentence = (s) => {
      const lower = s.toLowerCase();
      let score = 0;
      for (const kw of keywords) if (lower.includes(kw)) score += 12;
      if (/[0-9]/.test(s)) score += 8;
      // Prefer concise (10-220 chars), penalize too short/long
      const len = s.length;
      if (len >= 60 && len <= 180) score += 14;
      else if (len >= 35 && len < 60) score += 8;
      else if (len > 220) score -= 10;
      // Mild boost for colon-separated findings
      if (s.includes(':')) score += 4;
      // Penalize headers/metadata
      if (/^(report|date|sample|lab|page|ref|id)\b/i.test(s)) score -= 15;
      return score;
    };

    // Simplify jargon to layperson wording
    const simplify = (s) => {
      const replacements = [
        [/deficien\w*/gi, 'low'],
        [/excess/gi, 'high'],
        [/application/gi, 'use'],
        [/administer/gi, 'use'],
        [/amendment/gi, 'improvement'],
        [/recommendation/gi, 'recommendation'],
        [/utili[sz]e/gi, 'use'],
        [/optimal/gi, 'ideal'],
        [/parameters?/gi, 'levels'],
        [/concentration/gi, 'level'],
        [/ppm\b/gi, 'parts per million'],
        [/mg\/?kg/gi, 'mg per kg'],
        [/kg\/?ha/gi, 'kg per hectare'],
        [/\bph\b/gi, 'pH'],
      ];
      let out = s;
      for (const [re, to] of replacements) out = out.replace(re, to);
      // Trim and normalize spacing/punctuation
      out = out.replace(/\s+/g, ' ').trim();
      // Keep sentences short and clear
      if (out.length > 180) out = out.slice(0, 177).replace(/[,:;\-\s]+$/,'').trim() + '...';
      // Capitalize first letter
      out = out.charAt(0).toUpperCase() + out.slice(1);
      // Remove trailing repeated punctuation
      out = out.replace(/[.!?]+$/,'');
      return out;
    };

    // Rank and pick top 3–5 sentences
    const ranked = unique
      .map(s => ({ s, score: scoreSentence(s) }))
      .sort((a, b) => b.score - a.score)
      .map(x => x.s);

    const picked = [];
    const usedStarts = new Set();
    for (const s of ranked) {
      const simple = simplify(s);
      const startKey = simple.slice(0, 24).toLowerCase();
      if (usedStarts.has(startKey)) continue;
      usedStarts.add(startKey);
      picked.push(simple);
      if (picked.length >= 5) break;
    }

    if (picked.length === 0) picked.push('No clear findings extracted from the document.');

    // Format as concise, professional bullet points
    const summary = picked.slice(0, Math.min(5, Math.max(3, picked.length)))
      .map(line => `- ${line}`)
      .join('\n');

    return res.json({ success: true, summary, text });
  } catch (e) {
    console.error('OCR PDF summary error:', e?.response?.data || e);
    return res.status(500).json({ success: false, message: 'OCR failed. Please try again later.' });
  }
});

// Farm Logbook Routes
// POST /api/farmer/logs - Add new log entry
router.post('/logs', auth, [
  body('date').isISO8601().withMessage('Date must be a valid ISO 8601 date'),
  body('activityType').isIn(['Sowing', 'Irrigation', 'Fertilizer', 'Harvesting', 'Government Scheme', 'AI Recommendation', 'Other']).withMessage('Invalid activity type'),
  body('crop').optional().isString().trim().isLength({ max: 100 }).withMessage('Crop name cannot exceed 100 characters'),
  body('notes').optional().isString().trim().isLength({ max: 1000 }).withMessage('Notes cannot exceed 1000 characters')
], validate, async (req, res) => {
  try {
    const { date, activityType, crop, notes } = req.body;
    
    const logEntry = await FarmLog.create({
      farmerId: req.user._id,
      date: new Date(date),
      activityType,
      crop: crop || undefined,
      notes: notes || undefined
    });

    res.status(201).json({
      success: true,
      message: 'Farm log entry added successfully',
      data: logEntry
    });
  } catch (error) {
    console.error('Add farm log error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add farm log entry'
    });
  }
});

// GET /api/farmer/logs - Fetch farmer's log entries with filters
router.get('/logs', auth, async (req, res) => {
  try {
    const { activityType, crop, startDate, endDate, limit = 50 } = req.query;
    
    const filters = {};
    if (activityType) filters.activityType = activityType;
    if (crop) filters.crop = crop;
    if (startDate && endDate) {
      filters.startDate = startDate;
      filters.endDate = endDate;
    }
    filters.limit = parseInt(limit);

    const logs = await FarmLog.getFilteredLogs(req.user._id, filters);
    
    res.json({
      success: true,
      data: {
        logs,
        total: logs.length,
        filters: {
          activityType: activityType || null,
          crop: crop || null,
          dateRange: startDate && endDate ? { startDate, endDate } : null
        }
      }
    });
  } catch (error) {
    console.error('Get farm logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch farm logs'
    });
  }
});

// PUT /api/farmer/logs/:id - Edit a log entry
router.put('/logs/:id', auth, [
  body('date').optional().isISO8601().withMessage('Date must be a valid ISO 8601 date'),
  body('activityType').optional().isIn(['Sowing', 'Irrigation', 'Fertilizer', 'Harvesting', 'Government Scheme', 'AI Recommendation', 'Other']).withMessage('Invalid activity type'),
  body('crop').optional().isString().trim().isLength({ max: 100 }).withMessage('Crop name cannot exceed 100 characters'),
  body('notes').optional().isString().trim().isLength({ max: 1000 }).withMessage('Notes cannot exceed 1000 characters')
], validate, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined || updateData[key] === '') {
        delete updateData[key];
      }
    });

    if (updateData.date) {
      updateData.date = new Date(updateData.date);
    }

    const logEntry = await FarmLog.findOneAndUpdate(
      { _id: id, farmerId: req.user._id },
      updateData,
      { new: true, runValidators: true }
    );

    if (!logEntry) {
      return res.status(404).json({
        success: false,
        message: 'Farm log entry not found or you do not have permission to edit it'
      });
    }

    res.json({
      success: true,
      message: 'Farm log entry updated successfully',
      data: logEntry
    });
  } catch (error) {
    console.error('Update farm log error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update farm log entry'
    });
  }
});

// DELETE /api/farmer/logs/:id - Delete a log entry
router.delete('/logs/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const logEntry = await FarmLog.findOneAndDelete({
      _id: id,
      farmerId: req.user._id
    });

    if (!logEntry) {
      return res.status(404).json({
        success: false,
        message: 'Farm log entry not found or you do not have permission to delete it'
      });
    }

    res.json({
      success: true,
      message: 'Farm log entry deleted successfully'
    });
  } catch (error) {
    console.error('Delete farm log error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete farm log entry'
    });
  }
});

// GET /api/farmer/logs/stats - Get farm log statistics
router.get('/logs/stats', auth, async (req, res) => {
  try {
    const farmerId = req.user._id;
    
    // Get total logs count
    const totalLogs = await FarmLog.countDocuments({ farmerId });
    
    // Get logs by activity type
    const activityStats = await FarmLog.aggregate([
      { $match: { farmerId: new mongoose.Types.ObjectId(farmerId) } },
      { $group: { _id: '$activityType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get logs by crop
    const cropStats = await FarmLog.aggregate([
      { $match: { farmerId: new mongoose.Types.ObjectId(farmerId), crop: { $exists: true, $ne: null } } },
      { $group: { _id: '$crop', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentActivity = await FarmLog.countDocuments({
      farmerId,
      date: { $gte: thirtyDaysAgo }
    });

    res.json({
      success: true,
      data: {
        totalLogs,
        activityStats,
        cropStats,
        recentActivity,
        period: '30 days'
      }
    });
  } catch (error) {
    console.error('Get farm log stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch farm log statistics'
    });
  }
});

module.exports = router;
// Government Schemes: filter by crop and region
router.get('/schemes', auth, async (req, res) => {
  try {
    let { crop, region } = req.query;
    const filters = {};

    if (crop) {
      const c = String(crop).trim();
      filters.$or = [
        { crop: c },
        { crop: { $in: ['All', 'all', 'ALL', 'All Crops'] } }
      ];
    }

    if (region) {
      const r = String(region).trim();
      const or = filters.$or || [];
      or.push({ region: r });
      or.push({ region: { $in: ['All', 'all', 'ALL', 'All India'] } });
      filters.$or = or;
    }

    // If neither filter provided, show latest general schemes
    const today = new Date();
    const query = Object.keys(filters).length ? filters : {};
    // Auto-hide expired schemes
    query.$or = [
      ...(Array.isArray(query.$or) ? query.$or : []),
      { endDate: { $exists: false } },
      { endDate: null },
      { endDate: { $gte: today } }
    ];
    const list = await Scheme.find(query).sort({ lastUpdated: -1 }).limit(100);

    if (!list || list.length === 0) {
      return res.status(200).json({ message: 'No schemes available for your crop/region.' });
    }

    const results = list.map(s => ({
      title: s.title,
      crop: s.crop,
      region: s.region,
      category: s.category,
      eligibility: s.eligibility,
      benefits: s.benefits,
      howToApply: s.howToApply,
      source: s.source,
      lastUpdated: s.lastUpdated
    }));

    return res.json(results);
  } catch (e) {
    console.error('Farmer schemes error:', e);
    return res.status(500).json({ success: false, message: 'Failed to fetch schemes' });
  }
});

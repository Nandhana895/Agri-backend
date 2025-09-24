const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
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
  body('activityType').isIn(['Sowing', 'Irrigation', 'Fertilizer', 'Harvesting', 'Government Scheme', 'Other']).withMessage('Invalid activity type'),
  body('crop').optional().isString().trim().isLength({ max: 100 }).withMessage('Crop name cannot exceed 100 characters'),
  body('notes').optional().isString().trim().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
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
  body('activityType').optional().isIn(['Sowing', 'Irrigation', 'Fertilizer', 'Harvesting', 'Government Scheme', 'Other']).withMessage('Invalid activity type'),
  body('crop').optional().isString().trim().isLength({ max: 100 }).withMessage('Crop name cannot exceed 100 characters'),
  body('notes').optional().isString().trim().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
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

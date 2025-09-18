const express = require('express');
const auth = require('../middleware/auth');
const CropCalendar = require('../models/CropCalendar');
const User = require('../models/User');
const ActionLog = require('../models/ActionLog');

const router = express.Router();

// Expert-only: sowing trends aggregation endpoint
router.get('/sowing-trends', auth, async (req, res) => {
  try {
    // Check if user is expert or admin
    if (req.user.role !== 'expert' && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Expert access required' 
      });
    }

    const { region, crop, month, season, agroZone } = req.query;

    // Build aggregation pipeline
    const pipeline = [];
    const matchStage = {};

    // Add filters
    if (region && region !== 'all') {
      matchStage.$or = [
        { region: region },
        { region: 'all' }
      ];
    }
    if (crop) {
      matchStage.crop_lower = { $regex: crop.toLowerCase(), $options: 'i' };
    }
    if (season) {
      matchStage.season = season;
    }
    if (agroZone) {
      matchStage.agroZone = agroZone;
    }

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // Group by different dimensions for analysis
    const groupStage = {
      _id: {
        crop: '$crop',
        season: '$season',
        region: '$region',
        agroZone: '$agroZone'
      },
      count: { $sum: 1 },
      startMonths: { $addToSet: '$startMonth' },
      endMonths: { $addToSet: '$endMonth' },
      sources: { $addToSet: '$source' },
      lastUpdated: { $max: '$lastUpdated' }
    };

    pipeline.push({ $group: groupStage });

    // Sort by count descending
    pipeline.push({ $sort: { count: -1 } });

    const trends = await CropCalendar.aggregate(pipeline);

    // Calculate additional metrics
    const totalRecords = await CropCalendar.countDocuments(matchStage);
    const uniqueCrops = await CropCalendar.distinct('crop', matchStage);
    const uniqueRegions = await CropCalendar.distinct('region', matchStage);

    // Monthly distribution analysis
    const monthlyPipeline = [
      ...pipeline.slice(0, -1), // Remove sort stage
      {
        $group: {
          _id: {
            startMonth: '$startMonth',
            endMonth: '$endMonth'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ];

    const monthlyDistribution = await CropCalendar.aggregate(monthlyPipeline);

    // Regional intensity analysis
    const regionalPipeline = [
      ...pipeline.slice(0, -1),
      {
        $group: {
          _id: '$region',
          count: { $sum: 1 },
          crops: { $addToSet: '$crop' }
        }
      },
      { $sort: { count: -1 } }
    ];

    const regionalIntensity = await CropCalendar.aggregate(regionalPipeline);

    // Crop popularity analysis
    const cropPopularity = await CropCalendar.aggregate([
      ...pipeline.slice(0, -1),
      {
        $group: {
          _id: '$crop',
          count: { $sum: 1 },
          regions: { $addToSet: '$region' },
          seasons: { $addToSet: '$season' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Season-wise distribution
    const seasonDistribution = await CropCalendar.aggregate([
      ...pipeline.slice(0, -1),
      {
        $group: {
          _id: '$season',
          count: { $sum: 1 },
          crops: { $addToSet: '$crop' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Log the query for audit
    await ActionLog.create({
      actor: req.user._id,
      action: 'sowing_trends_query',
      targetType: 'CropCalendar',
      meta: {
        filters: { region, crop, month, season, agroZone },
        resultCount: trends.length,
        totalRecords
      }
    });

    res.json({
      success: true,
      data: {
        trends,
        summary: {
          totalRecords,
          uniqueCrops: uniqueCrops.length,
          uniqueRegions: uniqueRegions.length,
          filteredCount: trends.length
        },
        analytics: {
          monthlyDistribution,
          regionalIntensity,
          cropPopularity,
          seasonDistribution
        },
        filters: {
          region,
          crop,
          month,
          season,
          agroZone
        }
      }
    });

  } catch (error) {
    console.error('Expert sowing trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sowing trends data'
    });
  }
});

// Expert: Get sowing calendar records for analysis
router.get('/sowing-calendar', auth, async (req, res) => {
  try {
    // Check if user is expert or admin
    if (req.user.role !== 'expert' && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Expert access required' 
      });
    }

    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    // Build search filter
    const search = req.query.search;
    const filter = {};
    if (search) {
      filter.$or = [
        { crop: { $regex: search, $options: 'i' } },
        { region: { $regex: search, $options: 'i' } },
        { season: { $regex: search, $options: 'i' } }
      ];
    }

    const [records, total] = await Promise.all([
      CropCalendar.find(filter)
        .sort({ lastUpdated: -1 })
        .skip(skip)
        .limit(limit),
      CropCalendar.countDocuments(filter)
    ]);

    res.json({
      success: true,
      records,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Expert get sowing calendar error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Expert: Get regional sowing intensity heatmap data
router.get('/sowing-heatmap', auth, async (req, res) => {
  try {
    if (req.user.role !== 'expert' && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Expert access required' 
      });
    }

    const { season, crop } = req.query;
    const matchStage = {};
    
    if (season) matchStage.season = season;
    if (crop) matchStage.crop_lower = { $regex: crop.toLowerCase(), $options: 'i' };

    const heatmapData = await CropCalendar.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            region: '$region',
            agroZone: '$agroZone'
          },
          intensity: { $sum: 1 },
          crops: { $addToSet: '$crop' },
          seasons: { $addToSet: '$season' }
        }
      },
      {
        $group: {
          _id: '$_id.region',
          totalIntensity: { $sum: '$intensity' },
          agroZones: {
            $push: {
              zone: '$_id.agroZone',
              intensity: '$intensity',
              crops: '$crops',
              seasons: '$seasons'
            }
          }
        }
      },
      { $sort: { totalIntensity: -1 } }
    ]);

    res.json({
      success: true,
      data: heatmapData,
      filters: { season, crop }
    });

  } catch (error) {
    console.error('Expert sowing heatmap error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Expert: Get monthly sowing distribution
router.get('/sowing-distribution', auth, async (req, res) => {
  try {
    if (req.user.role !== 'expert' && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Expert access required' 
      });
    }

    const { region, crop, season } = req.query;
    const matchStage = {};
    
    if (region && region !== 'all') {
      matchStage.$or = [{ region }, { region: 'all' }];
    }
    if (crop) matchStage.crop_lower = { $regex: crop.toLowerCase(), $options: 'i' };
    if (season) matchStage.season = season;

    const monthlyData = await CropCalendar.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            startMonth: '$startMonth',
            endMonth: '$endMonth',
            crop: '$crop',
            season: '$season'
          },
          count: { $sum: 1 },
          regions: { $addToSet: '$region' }
        }
      },
      {
        $group: {
          _id: {
            startMonth: '$_id.startMonth',
            endMonth: '$_id.endMonth'
          },
          totalCount: { $sum: '$count' },
          crops: { $addToSet: '$_id.crop' },
          seasons: { $addToSet: '$_id.season' },
          regions: { $addToSet: { $arrayElemAt: ['$regions', 0] } }
        }
      },
      { $sort: { totalCount: -1 } }
    ]);

    // Calculate percentage distribution
    const totalRecords = monthlyData.reduce((sum, item) => sum + item.totalCount, 0);
    const distributionWithPercentage = monthlyData.map(item => ({
      ...item,
      percentage: totalRecords > 0 ? Math.round((item.totalCount / totalRecords) * 100) : 0
    }));

    res.json({
      success: true,
      data: distributionWithPercentage,
      summary: {
        totalRecords,
        uniqueMonths: monthlyData.length
      },
      filters: { region, crop, season }
    });

  } catch (error) {
    console.error('Expert sowing distribution error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Expert: Get crop popularity trends
router.get('/crop-popularity', auth, async (req, res) => {
  try {
    if (req.user.role !== 'expert' && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Expert access required' 
      });
    }

    const { region, season, limit = 20 } = req.query;
    const matchStage = {};
    
    if (region && region !== 'all') {
      matchStage.$or = [{ region }, { region: 'all' }];
    }
    if (season) matchStage.season = season;

    const popularityData = await CropCalendar.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$crop',
          count: { $sum: 1 },
          regions: { $addToSet: '$region' },
          seasons: { $addToSet: '$season' },
          agroZones: { $addToSet: '$agroZone' },
          sources: { $addToSet: '$source' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: parseInt(limit) }
    ]);

    // Calculate percentages
    const totalCount = popularityData.reduce((sum, item) => sum + item.count, 0);
    const popularityWithPercentage = popularityData.map(item => ({
      ...item,
      percentage: totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0
    }));

    res.json({
      success: true,
      data: popularityWithPercentage,
      summary: {
        totalCrops: popularityData.length,
        totalRecords: totalCount
      },
      filters: { region, season }
    });

  } catch (error) {
    console.error('Expert crop popularity error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

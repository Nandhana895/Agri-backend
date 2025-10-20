const express = require('express');
const router = express.Router();
const Field = require('../models/Field');
const User = require('../models/User');
const auth = require('../middleware/auth');

// @route   POST /api/farmer/fields
// @desc    Create a new field
// @access  Private (Farmer only)
router.post('/', auth, async (req, res) => {
  try {
    const {
      fieldName,
      crop,
      area,
      areaUnit,
      soilType,
      location,
      boundary,
      description,
      plantingDate,
      expectedHarvestDate
    } = req.body;

    // Validate required fields
    if (!fieldName || !area || !location?.latitude || !location?.longitude) {
      return res.status(400).json({
        success: false,
        message: 'Field name, area, and location coordinates are required'
      });
    }

    // Check if field name already exists for this farmer
    const existingField = await Field.findOne({
      farmerId: req.user.id,
      fieldName: fieldName.trim()
    });

    if (existingField) {
      return res.status(400).json({
        success: false,
        message: 'A field with this name already exists'
      });
    }

    // Create new field
    const field = new Field({
      farmerId: req.user.id,
      fieldName: fieldName.trim(),
      crop: crop?.trim(),
      area: parseFloat(area),
      areaUnit: areaUnit || 'acres',
      soilType: soilType || 'Loamy',
      location: {
        latitude: parseFloat(location.latitude),
        longitude: parseFloat(location.longitude),
        address: location.address?.trim()
      },
      boundary: boundary || [],
      description: description?.trim(),
      plantingDate: plantingDate ? new Date(plantingDate) : null,
      expectedHarvestDate: expectedHarvestDate ? new Date(expectedHarvestDate) : null
    });

    await field.save();

    // Add field to user's fields array
    await User.findByIdAndUpdate(
      req.user.id,
      { $push: { fields: field._id } },
      { new: true }
    );

    // Set as active field if it's the first field
    const userFieldCount = await Field.countDocuments({ farmerId: req.user.id });
    if (userFieldCount === 1) {
      await User.findByIdAndUpdate(
        req.user.id,
        { activeFieldId: field._id },
        { new: true }
      );
    }

    res.status(201).json({
      success: true,
      message: 'Field created successfully',
      data: field
    });

  } catch (error) {
    console.error('Error creating field:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating field',
      error: error.message
    });
  }
});

// @route   GET /api/farmer/fields
// @desc    Get all fields for logged-in farmer
// @access  Private (Farmer only)
router.get('/', auth, async (req, res) => {
  try {
    const { status, includeArchived } = req.query;
    
    let query = { farmerId: req.user.id };
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    } else if (!includeArchived) {
      // Exclude archived fields by default
      query.status = { $ne: 'Archived' };
    }

    const fields = await Field.find(query)
      .populate('logs', 'type date description')
      .populate('expenses', 'amount category date')
      .populate('tasks', 'title status dueDate')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: fields,
      count: fields.length
    });

  } catch (error) {
    console.error('Error fetching fields:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching fields',
      error: error.message
    });
  }
});

// @route   GET /api/farmer/fields/:id
// @desc    Get a single field by ID
// @access  Private (Farmer only)
router.get('/:id', auth, async (req, res) => {
  try {
    const field = await Field.findOne({
      _id: req.params.id,
      farmerId: req.user.id
    })
      .populate('logs', 'type date description')
      .populate('expenses', 'amount category date')
      .populate('tasks', 'title status dueDate');

    if (!field) {
      return res.status(404).json({
        success: false,
        message: 'Field not found'
      });
    }

    res.json({
      success: true,
      data: field
    });

  } catch (error) {
    console.error('Error fetching field:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching field',
      error: error.message
    });
  }
});

// @route   PUT /api/farmer/fields/:id
// @desc    Update field details
// @access  Private (Farmer only)
router.put('/:id', auth, async (req, res) => {
  try {
    const {
      fieldName,
      crop,
      area,
      areaUnit,
      soilType,
      location,
      boundary,
      description,
      plantingDate,
      expectedHarvestDate,
      status
    } = req.body;

    const field = await Field.findOne({
      _id: req.params.id,
      farmerId: req.user.id
    });

    if (!field) {
      return res.status(404).json({
        success: false,
        message: 'Field not found'
      });
    }

    // Check if field name already exists for this farmer (excluding current field)
    if (fieldName && fieldName.trim() !== field.fieldName) {
      const existingField = await Field.findOne({
        farmerId: req.user.id,
        fieldName: fieldName.trim(),
        _id: { $ne: req.params.id }
      });

      if (existingField) {
        return res.status(400).json({
          success: false,
          message: 'A field with this name already exists'
        });
      }
    }

    // Update field
    const updateData = {};
    if (fieldName) updateData.fieldName = fieldName.trim();
    if (crop !== undefined) updateData.crop = crop?.trim();
    if (area !== undefined) updateData.area = parseFloat(area);
    if (areaUnit) updateData.areaUnit = areaUnit;
    if (soilType) updateData.soilType = soilType;
    if (location) {
      updateData.location = {
        latitude: parseFloat(location.latitude),
        longitude: parseFloat(location.longitude),
        address: location.address?.trim()
      };
    }
    if (boundary) updateData.boundary = boundary;
    if (description !== undefined) updateData.description = description?.trim();
    if (plantingDate) updateData.plantingDate = new Date(plantingDate);
    if (expectedHarvestDate) updateData.expectedHarvestDate = new Date(expectedHarvestDate);
    if (status) updateData.status = status;

    const updatedField = await Field.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('logs', 'type date description')
      .populate('expenses', 'amount category date')
      .populate('tasks', 'title status dueDate');

    res.json({
      success: true,
      message: 'Field updated successfully',
      data: updatedField
    });

  } catch (error) {
    console.error('Error updating field:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating field',
      error: error.message
    });
  }
});

// @route   DELETE /api/farmer/fields/:id
// @desc    Delete (archive) a field
// @access  Private (Farmer only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const { permanent } = req.query;
    
    const field = await Field.findOne({
      _id: req.params.id,
      farmerId: req.user.id
    });

    if (!field) {
      return res.status(404).json({
        success: false,
        message: 'Field not found'
      });
    }

    if (permanent === 'true') {
      // Permanently delete the field
      await Field.findByIdAndDelete(req.params.id);
      
      // Remove field from user's fields array
      await User.findByIdAndUpdate(
        req.user.id,
        { $pull: { fields: req.params.id } },
        { new: true }
      );

      // If this was the active field, set another field as active
      const user = await User.findById(req.user.id);
      if (user.activeFieldId && user.activeFieldId.toString() === req.params.id) {
        const remainingFields = await Field.find({ farmerId: req.user.id });
        if (remainingFields.length > 0) {
          await User.findByIdAndUpdate(
            req.user.id,
            { activeFieldId: remainingFields[0]._id },
            { new: true }
          );
        } else {
          await User.findByIdAndUpdate(
            req.user.id,
            { activeFieldId: null },
            { new: true }
          );
        }
      }

      res.json({
        success: true,
        message: 'Field permanently deleted'
      });
    } else {
      // Archive the field
      await Field.findByIdAndUpdate(
        req.params.id,
        { status: 'Archived' },
        { new: true }
      );

      res.json({
        success: true,
        message: 'Field archived successfully'
      });
    }

  } catch (error) {
    console.error('Error deleting field:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting field',
      error: error.message
    });
  }
});

// @route   PUT /api/farmer/fields/:id/set-active
// @desc    Set a field as active
// @access  Private (Farmer only)
router.put('/:id/set-active', auth, async (req, res) => {
  try {
    const field = await Field.findOne({
      _id: req.params.id,
      farmerId: req.user.id,
      status: 'Active'
    });

    if (!field) {
      return res.status(404).json({
        success: false,
        message: 'Active field not found'
      });
    }

    // Update user's active field
    await User.findByIdAndUpdate(
      req.user.id,
      { activeFieldId: field._id },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Active field updated successfully',
      data: field
    });

  } catch (error) {
    console.error('Error setting active field:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while setting active field',
      error: error.message
    });
  }
});

// @route   GET /api/farmer/fields/:id/analytics
// @desc    Get field analytics and statistics
// @access  Private (Farmer only)
router.get('/:id/analytics', auth, async (req, res) => {
  try {
    const field = await Field.findOne({
      _id: req.params.id,
      farmerId: req.user.id
    })
      .populate('logs', 'type date description')
      .populate('expenses', 'amount category date')
      .populate('tasks', 'title status dueDate');

    if (!field) {
      return res.status(404).json({
        success: false,
        message: 'Field not found'
      });
    }

    // Calculate analytics
    const analytics = {
      fieldInfo: {
        name: field.fieldName,
        area: field.area,
        areaUnit: field.areaUnit,
        crop: field.crop,
        soilType: field.soilType,
        status: field.status,
        fieldAge: field.fieldAge
      },
      expenses: {
        total: field.expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0),
        count: field.expenses.length,
        byCategory: field.expenses.reduce((acc, expense) => {
          const category = expense.category || 'Other';
          acc[category] = (acc[category] || 0) + (expense.amount || 0);
          return acc;
        }, {})
      },
      logs: {
        total: field.logs.length,
        byType: field.logs.reduce((acc, log) => {
          const type = log.type || 'Other';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {})
      },
      tasks: {
        total: field.tasks.length,
        completed: field.tasks.filter(task => task.status === 'Completed').length,
        pending: field.tasks.filter(task => task.status === 'Pending').length,
        overdue: field.tasks.filter(task => 
          task.status === 'Pending' && 
          task.dueDate && 
          new Date(task.dueDate) < new Date()
        ).length
      },
      performance: {
        yieldPerAcre: field.yield && field.area ? field.yield / field.area : null,
        costPerAcre: field.expenses.length > 0 && field.area ? 
          field.expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0) / field.area : null
      }
    };

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('Error fetching field analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching field analytics',
      error: error.message
    });
  }
});

module.exports = router;
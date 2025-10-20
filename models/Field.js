const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema({
  farmerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  fieldName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  crop: {
    type: String,
    trim: true,
    maxlength: 50
  },
  area: {
    type: Number,
    required: true,
    min: 0.01,
    max: 10000
  },
  areaUnit: {
    type: String,
    enum: ['acres', 'hectares'],
    default: 'acres'
  },
  soilType: {
    type: String,
    enum: ['Sandy', 'Loamy', 'Clayey', 'Silty', 'Peaty', 'Chalky', 'Other'],
    default: 'Loamy'
  },
  location: {
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180
    },
    address: {
      type: String,
      trim: true,
      maxlength: 200
    }
  },
  boundary: [{
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180
    }
  }],
  logs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FarmLog'
  }],
  expenses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expense'
  }],
  tasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Archived'],
    default: 'Active'
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  plantingDate: {
    type: Date
  },
  expectedHarvestDate: {
    type: Date
  },
  lastIrrigationDate: {
    type: Date
  },
  lastFertilizerDate: {
    type: Date
  },
  yield: {
    type: Number,
    min: 0
  },
  yieldUnit: {
    type: String,
    enum: ['quintals', 'tons', 'kg'],
    default: 'quintals'
  },
  notes: [{
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index for faster lookup
fieldSchema.index({ farmerId: 1, fieldName: 1 }, { unique: true });

// Virtual for total expenses
fieldSchema.virtual('totalExpenses').get(function() {
  return this.expenses.reduce((total, expense) => total + (expense.amount || 0), 0);
});

// Virtual for total logs count
fieldSchema.virtual('totalLogs').get(function() {
  return this.logs.length;
});

// Virtual for total tasks count
fieldSchema.virtual('totalTasks').get(function() {
  return this.tasks.length;
});

// Virtual for field age in days
fieldSchema.virtual('fieldAge').get(function() {
  if (this.plantingDate) {
    return Math.floor((Date.now() - this.plantingDate) / (1000 * 60 * 60 * 24));
  }
  return null;
});

// Pre-save middleware to validate boundary points
fieldSchema.pre('save', function(next) {
  if (this.boundary && this.boundary.length > 0) {
    // Validate that boundary forms a proper polygon (at least 3 points)
    if (this.boundary.length < 3) {
      return next(new Error('Field boundary must have at least 3 points to form a polygon'));
    }
    
    // Validate coordinate ranges
    for (const point of this.boundary) {
      if (point.latitude < -90 || point.latitude > 90) {
        return next(new Error('Invalid latitude in boundary coordinates'));
      }
      if (point.longitude < -180 || point.longitude > 180) {
        return next(new Error('Invalid longitude in boundary coordinates'));
      }
    }
  }
  next();
});

// Static method to find fields by farmer
fieldSchema.statics.findByFarmer = function(farmerId) {
  return this.find({ farmerId, status: { $ne: 'Archived' } })
    .populate('logs', 'type date description')
    .populate('expenses', 'amount category date')
    .populate('tasks', 'title status dueDate')
    .sort({ createdAt: -1 });
};

// Static method to find active fields
fieldSchema.statics.findActive = function(farmerId) {
  return this.find({ farmerId, status: 'Active' })
    .populate('logs', 'type date description')
    .populate('expenses', 'amount category date')
    .populate('tasks', 'title status dueDate')
    .sort({ fieldName: 1 });
};

// Instance method to calculate field area in different units
fieldSchema.methods.getAreaInUnit = function(unit) {
  const conversionRates = {
    'acres': { 'hectares': 0.404686, 'acres': 1 },
    'hectares': { 'acres': 2.47105, 'hectares': 1 }
  };
  
  if (this.areaUnit === unit) {
    return this.area;
  }
  
  const rate = conversionRates[this.areaUnit][unit];
  return rate ? this.area * rate : this.area;
};

// Instance method to get field center point
fieldSchema.methods.getCenterPoint = function() {
  if (this.boundary && this.boundary.length > 0) {
    const latSum = this.boundary.reduce((sum, point) => sum + point.latitude, 0);
    const lngSum = this.boundary.reduce((sum, point) => sum + point.longitude, 0);
    
    return {
      latitude: latSum / this.boundary.length,
      longitude: lngSum / this.boundary.length
    };
  }
  
  return this.location;
};

// Static method to get field statistics for a farmer
fieldSchema.statics.getFieldStats = async function(farmerId) {
  try {
    const totalFields = await this.countDocuments({ farmerId });
    const activeFields = await this.countDocuments({ farmerId, status: 'Active' });
    
    // Calculate total area
    const fields = await this.find({ farmerId });
    let totalArea = 0;
    let fieldsWithCrops = 0;
    
    fields.forEach(field => {
      // Convert all areas to acres for consistent calculation
      const areaInAcres = field.getAreaInUnit('acres');
      totalArea += areaInAcres;
      
      if (field.crop && field.crop.trim() !== '') {
        fieldsWithCrops++;
      }
    });
    
    return {
      totalFields,
      activeFields,
      totalArea: Math.round(totalArea * 100) / 100, // Round to 2 decimal places
      fieldsWithCrops
    };
  } catch (error) {
    console.error('Error getting field stats:', error);
    return {
      totalFields: 0,
      activeFields: 0,
      totalArea: 0,
      fieldsWithCrops: 0
    };
  }
};

module.exports = mongoose.model('Field', fieldSchema);
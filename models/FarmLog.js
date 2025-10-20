const mongoose = require('mongoose');

const farmLogSchema = new mongoose.Schema({
  farmerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Farmer ID is required'],
    index: true
  },
  fieldId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Field',
    index: true
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    index: true
  },
  activityType: {
    type: String,
    enum: ['Sowing', 'Irrigation', 'Fertilizer', 'Harvesting', 'Government Scheme', 'Other'],
    required: [true, 'Activity type is required'],
    index: true
  },
  crop: {
    type: String,
    trim: true,
    maxlength: [100, 'Crop name cannot exceed 100 characters']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
farmLogSchema.index({ farmerId: 1, date: -1 });
farmLogSchema.index({ farmerId: 1, activityType: 1 });
farmLogSchema.index({ farmerId: 1, crop: 1 });
farmLogSchema.index({ farmerId: 1, fieldId: 1 });
farmLogSchema.index({ fieldId: 1, date: -1 });

// Virtual for formatted date
farmLogSchema.virtual('formattedDate').get(function() {
  return this.date.toISOString().split('T')[0];
});

// Method to get activity type display name
farmLogSchema.methods.getActivityDisplayName = function() {
  const displayNames = {
    'Sowing': 'Sowing',
    'Irrigation': 'Irrigation',
    'Fertilizer': 'Fertilizer Application',
    'Harvesting': 'Harvesting',
    'Government Scheme': 'Government Scheme',
    'Other': 'Other Activity'
  };
  return displayNames[this.activityType] || this.activityType;
};

// Static method to get logs with filters
farmLogSchema.statics.getFilteredLogs = async function(farmerId, filters = {}) {
  const query = { farmerId };
  
  if (filters.activityType) {
    query.activityType = filters.activityType;
  }
  
  if (filters.crop) {
    query.crop = { $regex: filters.crop, $options: 'i' };
  }
  
  if (filters.startDate && filters.endDate) {
    query.date = {
      $gte: new Date(filters.startDate),
      $lte: new Date(filters.endDate)
    };
  }
  
  return this.find(query)
    .sort({ date: -1 })
    .limit(filters.limit || 50);
};

module.exports = mongoose.model('FarmLog', farmLogSchema);

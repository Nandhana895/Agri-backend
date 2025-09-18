const mongoose = require('mongoose');

const cropCalendarSchema = new mongoose.Schema({
  crop: {
    type: String,
    required: [true, 'Crop name is required'],
    trim: true,
    index: true
  },
  crop_lower: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  season: {
    type: String,
    enum: {
      values: ['Kharif', 'Rabi', 'Zaid'],
      message: 'Season must be one of: Kharif, Rabi, Zaid'
    },
    required: [true, 'Season is required'],
    index: true
  },
  startMonth: {
    type: String,
    required: [true, 'Start month is required'],
    trim: true
  },
  endMonth: {
    type: String,
    required: [true, 'End month is required'],
    trim: true
  },
  region: {
    type: String,
    default: 'all',
    trim: true,
    index: true
  },
  agroZone: {
    type: String,
    trim: true,
    index: true
  },
  notes: {
    type: String,
    trim: true
  },
  varieties: [{
    type: String,
    trim: true
  }],
  source: {
    type: String,
    trim: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Compound indexes for efficient querying
cropCalendarSchema.index({ crop_lower: 1, region: 1 });
cropCalendarSchema.index({ season: 1, region: 1 });
cropCalendarSchema.index({ agroZone: 1, season: 1 });

// Pre-save middleware to automatically set crop_lower
cropCalendarSchema.pre('save', function(next) {
  if (this.crop && !this.crop_lower) {
    this.crop_lower = this.crop.toLowerCase().trim();
  }
  next();
});

// Pre-update middleware to handle crop_lower in updates
cropCalendarSchema.pre(['updateOne', 'findOneAndUpdate'], function(next) {
  const update = this.getUpdate();
  if (update.crop && !update.crop_lower) {
    update.crop_lower = update.crop.toLowerCase().trim();
  }
  next();
});

// Static method to search crops by name and region
cropCalendarSchema.statics.searchCrops = function(query, region = null) {
  const searchQuery = {
    $or: [
      { crop: { $regex: query, $options: 'i' } },
      { crop_lower: { $regex: query.toLowerCase(), $options: 'i' } }
    ]
  };
  
  if (region && region !== 'all') {
    searchQuery.$and = [
      { $or: [{ region: region }, { region: 'all' }] }
    ];
  }
  
  return this.find(searchQuery).sort({ crop: 1 });
};

// Static method to get crops by season and region
cropCalendarSchema.statics.getCropsBySeason = function(season, region = null) {
  const query = { season };
  
  if (region && region !== 'all') {
    query.$or = [{ region }, { region: 'all' }];
  }
  
  return this.find(query).sort({ crop: 1 });
};

// Instance method to get formatted sowing period
cropCalendarSchema.methods.getSowingPeriod = function() {
  return `${this.startMonth} - ${this.endMonth}`;
};

// Instance method to check if crop is suitable for current month
cropCalendarSchema.methods.isSuitableForMonth = function(month) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  
  const startIndex = months.indexOf(this.startMonth);
  const endIndex = months.indexOf(this.endMonth);
  const currentIndex = months.indexOf(month);
  
  if (startIndex === -1 || endIndex === -1 || currentIndex === -1) {
    return false;
  }
  
  // Handle year-end wrap-around (e.g., November to February)
  if (startIndex > endIndex) {
    return currentIndex >= startIndex || currentIndex <= endIndex;
  }
  
  return currentIndex >= startIndex && currentIndex <= endIndex;
};

module.exports = mongoose.model('CropCalendar', cropCalendarSchema);

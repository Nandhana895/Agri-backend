const mongoose = require('mongoose');

const schemeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Scheme title is required'],
    trim: true
  },
  crop: {
    type: [String],
    default: [],
    index: true
  },
  region: {
    type: [String],
    default: [],
    index: true
  },
  category: {
    type: String,
    enum: ['Subsidy', 'Insurance', 'Loan', 'Support Price', 'Other'],
    default: 'Other'
  },
  eligibility: {
    type: String,
    default: ''
  },
  benefits: {
    type: String,
    default: ''
  },
  howToApply: {
    type: String,
    default: ''
  },
  startDate: {
    type: Date,
    default: null
  },
  endDate: {
    type: Date,
    default: null
  },
  source: {
    type: String,
    default: ''
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound and single-field indexes for fast filtering
schemeSchema.index({ crop: 1 });
schemeSchema.index({ region: 1 });

// Maintain lastUpdated automatically on changes
schemeSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

schemeSchema.pre('findOneAndUpdate', function(next) {
  this.set({ lastUpdated: new Date() });
  next();
});

module.exports = mongoose.model('Scheme', schemeSchema);



const mongoose = require('mongoose');

const fertilizerStandardSchema = new mongoose.Schema({
  crop: { 
    type: String, 
    required: true, 
    trim: true,
    index: true 
  },
  region: { 
    type: String, 
    required: true, 
    trim: true,
    index: true 
  },
  season: { 
    type: String, 
    enum: ['Kharif', 'Rabi', 'Zaid', 'All'],
    default: 'All'
  },
  // Nutrient requirements per hectare (kg/ha)
  nitrogenPerHa: { type: Number, required: true },
  phosphorusPerHa: { type: Number, required: true },
  potassiumPerHa: { type: Number, required: true },
  
  // Soil type adjustments (multipliers)
  soilAdjustments: {
    sandy: { nitrogen: Number, phosphorus: Number, potassium: Number },
    clay: { nitrogen: Number, phosphorus: Number, potassium: Number },
    loamy: { nitrogen: Number, phosphorus: Number, potassium: Number },
    silty: { nitrogen: Number, phosphorus: Number, potassium: Number },
    peaty: { nitrogen: Number, phosphorus: Number, potassium: Number },
    chalky: { nitrogen: Number, phosphorus: Number, potassium: Number }
  },
  
  // Organic matter adjustments
  organicMatterAdjustments: {
    low: { nitrogen: Number, phosphorus: Number, potassium: Number }, // < 1%
    medium: { nitrogen: Number, phosphorus: Number, potassium: Number }, // 1-3%
    high: { nitrogen: Number, phosphorus: Number, potassium: Number } // > 3%
  },
  
  // Split dose recommendations
  splitDoses: [{
    stage: { type: String, required: true },
    nitrogenPercent: { type: Number, default: 0 },
    phosphorusPercent: { type: Number, default: 0 },
    potassiumPercent: { type: Number, default: 0 },
    timing: { type: String },
    notes: { type: String }
  }],
  
  // Crop-specific tips
  tips: [String],
  
  // Organic alternatives
  organicAdvice: {
    compost: { amount: String, timing: String },
    manure: { amount: String, timing: String },
    greenManure: { crops: [String], timing: String },
    biofertilizers: [String]
  },
  
  // Source and validation
  source: { type: String, default: 'ICAR/KVK' },
  lastUpdated: { type: Date, default: Date.now },
  validated: { type: Boolean, default: true }
}, { 
  timestamps: true,
  indexes: [
    { crop: 1, region: 1 },
    { region: 1, season: 1 }
  ]
});

module.exports = mongoose.model('FertilizerStandard', fertilizerStandardSchema);

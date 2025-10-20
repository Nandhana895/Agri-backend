const mongoose = require('mongoose');

const fertilizerPlanSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fieldId: { type: mongoose.Schema.Types.ObjectId, ref: 'Field', index: true },
  areaAcres: { type: Number, required: true },
  areaUnit: { type: String, enum: ['acre', 'hectare', 'sqm'], default: 'acre' },
  crop: { type: String, required: true },
  region: { type: String, required: true },
  soilType: { type: String },
  organicCarbon: { type: Number },
  soilN: { type: String, enum: ['low', 'medium', 'high'] },
  soilP: { type: String, enum: ['low', 'medium', 'high'] },
  soilK: { type: String, enum: ['low', 'medium', 'high'] },
  fromSoilAnalysisId: { type: mongoose.Schema.Types.ObjectId, ref: 'SoilAnalysis' },
  
  // Calculated results
  recommended: {
    nitrogen: { type: Number, required: true },
    phosphorus: { type: Number, required: true },
    potassium: { type: Number, required: true }
  },
  fertilizer: {
    urea: { type: Number, required: true },
    dap: { type: Number, required: true },
    mop: { type: Number, required: true }
  },
  unit: { type: String, enum: ['kg', 'g'], required: true },
  
  splitDoses: [{
    stage: { type: String, required: true },
    urea: { type: Number, default: 0 },
    dap: { type: Number, default: 0 },
    mop: { type: Number, default: 0 },
    timing: { type: String },
    notes: { type: String }
  }],
  
  tips: [String],
  organicAdvice: { type: String },
  message: { type: String },
  
  // Legacy fields for backward compatibility
  dosageKg: { type: Number },
  breakdown: { type: Object },
  formula: { type: String, default: 'NPK 10-10-10' },
  notes: { type: String }
}, { timestamps: true });

// Compound indexes for efficient queries
fertilizerPlanSchema.index({ user: 1, fieldId: 1 });
fertilizerPlanSchema.index({ fieldId: 1, createdAt: -1 });

module.exports = mongoose.model('FertilizerPlan', fertilizerPlanSchema);



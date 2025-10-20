const mongoose = require('mongoose');

const soilAnalysisSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fieldId: { type: mongoose.Schema.Types.ObjectId, ref: 'Field', index: true },
  ph: { type: Number, required: true },
  organicMatter: { type: Number, required: true },
  moisture: { type: Number, required: true },
  nitrogen: { type: Number },
  phosphorus: { type: Number },
  potassium: { type: Number },
  soilType: { type: String },
  location: { type: String },
  status: { type: String, default: '' },
  fertilizerSuggestion: { type: String, default: '' },
  analysis: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

// Compound indexes for efficient queries
soilAnalysisSchema.index({ user: 1, fieldId: 1 });
soilAnalysisSchema.index({ fieldId: 1, createdAt: -1 });

module.exports = mongoose.model('SoilAnalysis', soilAnalysisSchema);



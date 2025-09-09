const mongoose = require('mongoose');

const soilAnalysisSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  ph: { type: Number, required: true },
  organicMatter: { type: Number, required: true },
  moisture: { type: Number, required: true },
  status: { type: String, default: '' },
  fertilizerSuggestion: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('SoilAnalysis', soilAnalysisSchema);



const mongoose = require('mongoose');

const fertilizerPlanSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  areaAcres: { type: Number, required: true },
  crop: { type: String, required: true },
  dosageKg: { type: Number, required: true },
  formula: { type: String, default: 'NPK 10-10-10' }
}, { timestamps: true });

module.exports = mongoose.model('FertilizerPlan', fertilizerPlanSchema);



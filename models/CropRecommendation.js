const mongoose = require('mongoose');

const cropRecommendationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  nitrogen: { type: Number, required: true },
  phosphorus: { type: Number, required: true },
  potassium: { type: Number, required: true },
  ph: { type: Number, required: true },
  rainfall: { type: Number, required: true },
  recommendedCrops: { type: [String], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('CropRecommendation', cropRecommendationSchema);



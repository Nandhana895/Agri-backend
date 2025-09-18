const mongoose = require('mongoose');

const cropProfileSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  name_ml: {
    type: String,
    trim: true,
    default: ''
  },
  imageUrl: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  description_ml: {
    type: String,
    default: ''
  },
  cultivationTips: {
    type: [String],
    default: []
  },
  cultivationTips_ml: {
    type: [String],
    default: []
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

module.exports = mongoose.model('CropProfile', cropProfileSchema);



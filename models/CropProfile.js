const mongoose = require('mongoose');

const cropProfileSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  imageUrl: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  cultivationTips: {
    type: [String],
    default: []
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

module.exports = mongoose.model('CropProfile', cropProfileSchema);



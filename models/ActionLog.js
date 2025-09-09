const mongoose = require('mongoose');

const actionLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: { type: String, required: true, trim: true, index: true },
  targetType: { type: String, default: '', trim: true },
  targetId: { type: String, default: '', trim: true },
  meta: { type: Object, default: {} },
}, { timestamps: true });

module.exports = mongoose.model('ActionLog', actionLogSchema);



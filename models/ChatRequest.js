const mongoose = require('mongoose');

const ChatRequestSchema = new mongoose.Schema(
  {
    farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    expertId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    farmerNote: { type: String, maxlength: 500, default: '' },
    expertNote: { type: String, maxlength: 500, default: '' },
    approvedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ChatRequestSchema.index({ farmerId: 1, expertId: 1 }, { unique: true });

module.exports = mongoose.model('ChatRequest', ChatRequestSchema);



const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', index: true },
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fromEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    toEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    text: { type: String, required: true, maxlength: 2000 },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

MessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema);








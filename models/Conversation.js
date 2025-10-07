const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    participantEmails: [{ type: String, lowercase: true, trim: true }],
    lastMessageAt: { type: Date, default: Date.now },
    lastMessageText: { type: String, default: '' },
    pinnedMessages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: [] }],
  },
  { timestamps: true }
);

ConversationSchema.index({ lastMessageAt: -1 });
ConversationSchema.index({ participants: 1 });

module.exports = mongoose.model('Conversation', ConversationSchema);








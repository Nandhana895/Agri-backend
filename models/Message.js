const mongoose = require('mongoose');

const AttachmentSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    originalName: { type: String, required: true },
    path: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true }
  },
  { _id: false }
);

const MessageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', index: true },
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fromEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    toEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    text: { type: String, default: '', maxlength: 2000 },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    pinned: { type: Boolean, default: false, index: true },
    attachments: { type: [AttachmentSchema], default: [] }
  },
  { timestamps: true }
);

MessageSchema.index({ createdAt: -1 });
MessageSchema.index({ text: 'text' });

module.exports = mongoose.model('Message', MessageSchema);








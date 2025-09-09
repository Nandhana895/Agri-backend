const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const auth = require('../middleware/auth');

// All routes require auth
router.use(auth);

// List conversations for current user
router.get('/conversations', async (req, res) => {
  try {
    const userId = req.user._id;
    const convos = await Conversation.find({ participants: userId })
      .sort({ lastMessageAt: -1 })
      .limit(100)
      .lean();
    res.json({ success: true, conversations: convos });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to load conversations' });
  }
});

// Get or create conversation with a specific participant by email
router.post('/conversations/by-email', async (req, res) => {
  try {
    const userId = req.user._id;
    const userEmail = String(req.user.email || '').toLowerCase();
    const targetEmail = String(req.body.email || '').trim().toLowerCase();
    if (!targetEmail) return res.status(400).json({ success: false, message: 'Email required' });

    const User = mongoose.model('User');
    const target = await User.findOne({ email: targetEmail }).select('_id email');
    if (!target) return res.status(404).json({ success: false, message: 'Recipient not found' });

    let convo = await Conversation.findOne({ participants: { $all: [userId, target._id] } });
    if (!convo) {
      convo = await Conversation.create({
        participants: [userId, target._id],
        participantEmails: [userEmail, targetEmail],
        lastMessageAt: new Date(0),
        lastMessageText: ''
      });
    }

    res.json({ success: true, conversation: convo });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to resolve conversation' });
  }
});

// Fetch messages for a conversation
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const userId = req.user._id;
    const convoId = req.params.id;
    const convo = await Conversation.findById(convoId).select('participants');
    if (!convo || !convo.participants.some((p) => p.toString() === userId.toString())) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }
    const messages = await Message.find({ conversationId: convoId })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json({ success: true, messages: messages.reverse() });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to load messages' });
  }
});

// Mark messages as read in a conversation
router.post('/conversations/:id/read', async (req, res) => {
  try {
    const userId = req.user._id;
    const convoId = req.params.id;
    const convo = await Conversation.findById(convoId).select('participants');
    if (!convo || !convo.participants.some((p) => p.toString() === userId.toString())) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }
    await Message.updateMany({ conversationId: convoId, toUserId: userId, readAt: null }, { $set: { readAt: new Date() } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to mark as read' });
  }
});

module.exports = router;




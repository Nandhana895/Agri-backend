const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const ChatRequest = require('../models/ChatRequest');
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
    const target = await User.findOne({ email: targetEmail }).select('_id email role');
    if (!target) return res.status(404).json({ success: false, message: 'Recipient not found' });

    // If farmer initiating chat to expert, require approved request first
    const isFarmer = req.user.role === 'user';
    const isExpertTarget = target.role === 'expert';
    if (isFarmer && isExpertTarget) {
      const approved = await ChatRequest.findOne({ farmerId: userId, expertId: target._id, status: 'approved' })
        .select('_id');
      if (!approved) {
        return res.status(403).json({ success: false, requiresApproval: true, message: 'Chat not approved by expert yet' });
      }
    }

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

// Create chat request (farmer -> expert)
router.post('/requests', async (req, res) => {
  try {
    if (req.user.role !== 'user') return res.status(403).json({ success: false, message: 'Only farmers can request' });
    const expertEmail = String(req.body.expertEmail || '').trim().toLowerCase();
    const farmerNote = String(req.body.note || '').slice(0, 500);
    if (!expertEmail) return res.status(400).json({ success: false, message: 'expertEmail required' });
    const User = mongoose.model('User');
    const expert = await User.findOne({ email: expertEmail, role: 'expert' }).select('_id');
    if (!expert) return res.status(404).json({ success: false, message: 'Expert not found' });
    const doc = await ChatRequest.findOneAndUpdate(
      { farmerId: req.user._id, expertId: expert._id },
      { $setOnInsert: { status: 'pending' }, $set: { farmerNote } },
      { upsert: true, new: true }
    );
    return res.status(201).json({ success: true, data: doc });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to create request' });
  }
});

// Expert: list pending requests
router.get('/requests/pending', async (req, res) => {
  try {
    if (req.user.role !== 'expert') return res.status(403).json({ success: false, message: 'Only experts' });
    const list = await ChatRequest.find({ expertId: req.user._id, status: 'pending' })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    const farmerIds = list.map(r => r.farmerId);
    const User = mongoose.model('User');
    const farmers = await User.find({ _id: { $in: farmerIds } }).select('name email');
    const map = new Map(farmers.map(f => [f._id.toString(), { name: f.name, email: f.email }]));
    const enriched = list.map(r => ({ ...r, farmer: map.get(r.farmerId.toString()) }));
    return res.json({ success: true, data: enriched });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to load requests' });
  }
});

// Expert: approve a request
router.post('/requests/:id/approve', async (req, res) => {
  try {
    if (req.user.role !== 'expert') return res.status(403).json({ success: false, message: 'Only experts' });
    const doc = await ChatRequest.findOneAndUpdate(
      { _id: req.params.id, expertId: req.user._id },
      { $set: { status: 'approved', approvedAt: new Date(), expertNote: String(req.body.note || '').slice(0, 500) } },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Request not found' });
    return res.json({ success: true, data: doc });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Approve failed' });
  }
});

// Expert: reject a request
router.post('/requests/:id/reject', async (req, res) => {
  try {
    if (req.user.role !== 'expert') return res.status(403).json({ success: false, message: 'Only experts' });
    const doc = await ChatRequest.findOneAndUpdate(
      { _id: req.params.id, expertId: req.user._id },
      { $set: { status: 'rejected', rejectedAt: new Date(), expertNote: String(req.body.note || '').slice(0, 500) } },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Request not found' });
    return res.json({ success: true, data: doc });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Reject failed' });
  }
});

// Farmer: list my chat requests
router.get('/requests/mine', async (req, res) => {
  try {
    if (req.user.role !== 'user') return res.status(403).json({ success: false, message: 'Only farmers' });
    const list = await ChatRequest.find({ farmerId: req.user._id })
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();
    const expertIds = list.map(r => r.expertId);
    const User = mongoose.model('User');
    const experts = await User.find({ _id: { $in: expertIds } }).select('name email');
    const map = new Map(experts.map(e => [e._id.toString(), { name: e.name, email: e.email }]));
    const enriched = list.map(r => ({ ...r, expert: map.get(r.expertId.toString()) }));
    return res.json({ success: true, data: enriched });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to load my requests' });
  }
});

// Approved peers for current user (emails)
router.get('/approved-peers', async (req, res) => {
  try {
    const uid = req.user._id;
    let filter = {};
    if (req.user.role === 'user') {
      filter = { farmerId: uid, status: 'approved' };
    } else if (req.user.role === 'expert') {
      filter = { expertId: uid, status: 'approved' };
    } else {
      return res.json({ success: true, data: [] });
    }
    const list = await ChatRequest.find(filter).select('farmerId expertId');
    const ids = list.map(r => (req.user.role === 'user' ? r.expertId : r.farmerId));
    const User = mongoose.model('User');
    const users = await User.find({ _id: { $in: ids } }).select('email');
    return res.json({ success: true, data: users.map(u => u.email) });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to load approved peers' });
  }
});

module.exports = router;




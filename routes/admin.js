const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Admin-only: sample dashboard metrics
router.get('/dashboard', auth, auth.requireAdmin, async (req, res) => {
	try {
		res.json({
			success: true,
			message: 'Admin dashboard access granted',
			user: { id: req.user._id, name: req.user.name, role: req.user.role }
		});
	} catch (error) {
		console.error('Admin dashboard error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Admin overview with basic stats and recent users
router.get('/overview', auth, auth.requireAdmin, async (req, res) => {
	try {
		const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
		const [totalUsers, adminCount, newUsers7d, recentUsers] = await Promise.all([
			User.countDocuments({}),
			User.countDocuments({ role: 'admin' }),
			User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
			User.find({}).sort({ createdAt: -1 }).limit(5).select('name email role createdAt')
		]);

		res.json({
			success: true,
			stats: { totalUsers, adminCount, newUsers7d },
			recentUsers
		});
	} catch (error) {
		console.error('Admin overview error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Admin: list recent users (basic management table)
router.get('/users', auth, auth.requireAdmin, async (req, res) => {
	try {
		const limit = Math.min(Number(req.query.limit) || 50, 200);
		const users = await User.find({})
			.sort({ createdAt: -1 })
			.limit(limit)
			.select('name email role createdAt');
		res.json({ success: true, users });
	} catch (error) {
		console.error('Admin list users error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Admin: update user role
router.patch('/users/:id/role', auth, auth.requireAdmin, async (req, res) => {
	try {
		const { role } = req.body;
		if (!['user', 'admin'].includes(role)) {
			return res.status(400).json({ success: false, message: 'Invalid role' });
		}
		const user = await User.findByIdAndUpdate(
			req.params.id,
			{ role },
			{ new: true, select: 'name email role createdAt' }
		);
		if (!user) {
			return res.status(404).json({ success: false, message: 'User not found' });
		}
		res.json({ success: true, user });
	} catch (error) {
		console.error('Admin update role error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

module.exports = router;

const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const ActionLog = require('../models/ActionLog');
const CropProfile = require('../models/CropProfile');
const CropCalendar = require('../models/CropCalendar');
const Scheme = require('../models/Scheme');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  try { fs.mkdirSync(uploadsDir); } catch (_) {}
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `crop_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

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
		const [totalUsers, adminCount, newUsers7d, recentUsers, blockedUsers, inactiveUsers] = await Promise.all([
			User.countDocuments({}),
			User.countDocuments({ role: 'admin' }),
			User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
			User.find({}).sort({ createdAt: -1 }).limit(5).select('name email role createdAt'),
			User.countDocuments({ isBlocked: true }),
			User.countDocuments({ isActive: false })
		]);

		res.json({
			success: true,
			stats: { totalUsers, adminCount, newUsers7d, blockedUsers, inactiveUsers },
			recentUsers
		});
	} catch (error) {
		console.error('Admin overview error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Admin: system stats (pollable)
router.get('/stats', auth, auth.requireAdmin, async (req, res) => {
	try {
		const [totalUsers, activeUsers, blockedUsers, inactiveUsers] = await Promise.all([
			User.countDocuments({}),
			User.countDocuments({ isActive: true, isBlocked: false }),
			User.countDocuments({ isBlocked: true }),
			User.countDocuments({ isActive: false })
		]);

		const activeQueries = 0; // placeholder
		const pendingRecommendations = 0; // placeholder

		res.json({
			success: true,
			stats: { totalUsers, activeUsers, blockedUsers, inactiveUsers, activeQueries, pendingRecommendations }
		});
	} catch (error) {
		console.error('Admin stats error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Admin: data health summary (placeholder)
router.get('/data-health', auth, auth.requireAdmin, async (req, res) => {
	try {
		const totalUsers = await User.countDocuments({ role: 'user' });
		res.json({
			success: true,
			health: {
				usersWithIssues: 0,
				usersMissingSoilProfile: totalUsers,
				notes: 'Implement real checks for soil profiles and reports'
			}
		});
	} catch (error) {
		console.error('Admin data health error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Admin: bulk activate/deactivate users
router.post('/users/bulk-status', auth, auth.requireAdmin, async (req, res) => {
	try {
		const { userIds = [], isActive } = req.body;
		if (!Array.isArray(userIds) || typeof isActive !== 'boolean') {
			return res.status(400).json({ success: false, message: 'Invalid payload' });
		}
		const result = await User.updateMany({ _id: { $in: userIds } }, { $set: { isActive } });
		await ActionLog.create({ actor: req.user._id, action: isActive ? 'bulk_activate' : 'bulk_deactivate', targetType: 'User', targetId: userIds.join(','), meta: { count: result.modifiedCount } });
		res.json({ success: true, modified: result.modifiedCount });
	} catch (error) {
		console.error('Admin bulk status error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Admin: list action logs
router.get('/logs', auth, auth.requireAdmin, async (req, res) => {
	try {
		const limit = Math.min(Number(req.query.limit) || 20, 100);
		const page = Math.max(Number(req.query.page) || 1, 1);
		const skip = (page - 1) * limit;
		const [logs, total] = await Promise.all([
			ActionLog.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
			ActionLog.countDocuments({})
		]);
		res.json({ success: true, logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
	} catch (error) {
		console.error('Admin logs error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Admin: trigger model retrain (stub)
router.post('/ml/retrain', auth, auth.requireAdmin, async (req, res) => {
	try {
		await ActionLog.create({ actor: req.user._id, action: 'ml_retrain', targetType: 'system' });
		res.json({ success: true, message: 'Model retrain triggered (stub)' });
	} catch (error) {
		console.error('Admin ml retrain error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Admin: refresh recommendations (stub)
router.post('/ml/refresh-recommendations', auth, auth.requireAdmin, async (req, res) => {
	try {
		await ActionLog.create({ actor: req.user._id, action: 'refresh_recommendations', targetType: 'system' });
		res.json({ success: true, message: 'Recommendations refresh triggered (stub)' });
	} catch (error) {
		console.error('Admin refresh recs error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Admin: download analytics report (CSV)
router.get('/reports/analytics.csv', auth, auth.requireAdmin, async (req, res) => {
	try {
		res.setHeader('Content-Type', 'text/csv');
		res.setHeader('Content-Disposition', 'attachment; filename="analytics.csv"');
		const rows = [
			['Region', 'Crop', 'TrendScore', 'CommonPests', 'FertilizerDemand'],
			['North', 'Wheat', '0.82', 'Aphids;Rust', 'High'],
			['South', 'Rice', '0.74', 'Stem borer', 'Medium'],
			['East', 'Maize', '0.68', 'Armyworm', 'Low']
		];
		const csv = rows.map(r => r.join(',')).join('\n');
		res.send(csv);
	} catch (error) {
		console.error('Admin report csv error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Admin: list recent users (basic management table)
router.get('/users', auth, auth.requireAdmin, async (req, res) => {
	try {
		const limit = Math.min(Number(req.query.limit) || 50, 200);
		const page = Math.max(Number(req.query.page) || 1, 1);
		const skip = (page - 1) * limit;
		
		// Build search filter
		const search = req.query.search;
		const filter = {};
		if (search) {
			filter.$or = [
				{ name: { $regex: search, $options: 'i' } },
				{ email: { $regex: search, $options: 'i' } }
			];
		}
		
		const [users, total] = await Promise.all([
			User.find(filter)
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.select('name email role isActive isBlocked lastLogin createdAt updatedAt'),
			User.countDocuments(filter)
		]);
		
		res.json({ 
			success: true, 
			users,
			pagination: {
				page,
				limit,
				total,
				pages: Math.ceil(total / limit)
			}
		});
	} catch (error) {
		console.error('Admin list users error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Admin: get single user details
router.get('/users/:id', auth, auth.requireAdmin, async (req, res) => {
	try {
		const user = await User.findById(req.params.id)
			.select('name email role isActive isBlocked lastLogin createdAt updatedAt');
		
		if (!user) {
			return res.status(404).json({ success: false, message: 'User not found' });
		}
		
		res.json({ success: true, user });
	} catch (error) {
		console.error('Admin get user error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Admin: update user details
router.put('/users/:id', auth, auth.requireAdmin, async (req, res) => {
	try {
		const { name, email, role, isActive, isBlocked } = req.body;
		
		// Validate role if provided
		if (role && !['user', 'admin', 'expert'].includes(role)) {
			return res.status(400).json({ success: false, message: 'Invalid role' });
		}
		
		// Check if email is already taken by another user
		if (email) {
			const existingUser = await User.findOne({ 
				email, 
				_id: { $ne: req.params.id } 
			});
			if (existingUser) {
				return res.status(400).json({ 
					success: false, 
					message: 'Email already taken by another user' 
				});
			}
		}
		
		const updateData = {};
		if (name !== undefined) updateData.name = name;
		if (email !== undefined) updateData.email = email;
		if (role !== undefined) updateData.role = role;
		if (isActive !== undefined) updateData.isActive = isActive;
		if (isBlocked !== undefined) updateData.isBlocked = isBlocked;
		
		const user = await User.findByIdAndUpdate(
			req.params.id,
			updateData,
			{ new: true, select: 'name email role isActive isBlocked lastLogin createdAt updatedAt' }
		);
		
		if (!user) {
			return res.status(404).json({ success: false, message: 'User not found' });
		}
		
		res.json({ success: true, user });
	} catch (error) {
		console.error('Admin update user error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Admin: update user role
router.patch('/users/:id/role', auth, auth.requireAdmin, async (req, res) => {
	try {
		const { role } = req.body;
		if (!['user', 'admin', 'expert'].includes(role)) {
			return res.status(400).json({ success: false, message: 'Invalid role' });
		}
		const user = await User.findByIdAndUpdate(
			req.params.id,
			{ role },
			{ new: true, select: 'name email role isActive isBlocked lastLogin createdAt updatedAt' }
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

// Admin: block/unblock user
router.patch('/users/:id/block', auth, auth.requireAdmin, async (req, res) => {
	try {
		const { isBlocked } = req.body;
		
		// Prevent admin from blocking themselves
		if (req.params.id === req.user._id.toString()) {
			return res.status(400).json({ 
				success: false, 
				message: 'Cannot block your own account' 
			});
		}
		
		const user = await User.findByIdAndUpdate(
			req.params.id,
			{ isBlocked: Boolean(isBlocked) },
			{ new: true, select: 'name email role isActive isBlocked lastLogin createdAt updatedAt' }
		);
		
		if (!user) {
			return res.status(404).json({ success: false, message: 'User not found' });
		}
		
		res.json({ 
			success: true, 
			user,
			message: user.isBlocked ? 'User blocked successfully' : 'User unblocked successfully'
		});
	} catch (error) {
		console.error('Admin block user error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Admin: activate/deactivate user
router.patch('/users/:id/status', auth, auth.requireAdmin, async (req, res) => {
	try {
		const { isActive } = req.body;
		
		// Prevent admin from deactivating themselves
		if (req.params.id === req.user._id.toString()) {
			return res.status(400).json({ 
				success: false, 
				message: 'Cannot deactivate your own account' 
			});
		}
		
		const user = await User.findByIdAndUpdate(
			req.params.id,
			{ isActive: Boolean(isActive) },
			{ new: true, select: 'name email role isActive isBlocked lastLogin createdAt updatedAt' }
		);
		
		if (!user) {
			return res.status(404).json({ success: false, message: 'User not found' });
		}
		
		res.json({ 
			success: true, 
			user,
			message: user.isActive ? 'User activated successfully' : 'User deactivated successfully'
		});
	} catch (error) {
		console.error('Admin status change error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Admin: delete user
router.delete('/users/:id', auth, auth.requireAdmin, async (req, res) => {
	try {
		// Prevent admin from deleting themselves
		if (req.params.id === req.user._id.toString()) {
			return res.status(400).json({ 
				success: false, 
				message: 'Cannot delete your own account' 
			});
		}
		
		const user = await User.findByIdAndDelete(req.params.id);
		
		if (!user) {
			return res.status(404).json({ success: false, message: 'User not found' });
		}
		
		res.json({ 
			success: true, 
			message: 'User deleted successfully' 
		});
	} catch (error) {
		console.error('Admin delete user error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Admin: create new user
router.post('/users', auth, auth.requireAdmin, async (req, res) => {
	try {
		const { name, email, password, role = 'user', isActive = true } = req.body;
		
		// Validate required fields
		if (!name || !email) {
			return res.status(400).json({ 
				success: false, 
				message: 'Name and email are required' 
			});
		}
		
		// Validate role
		if (!['user', 'admin', 'expert'].includes(role)) {
			return res.status(400).json({ success: false, message: 'Invalid role' });
		}
		
		// Check if user already exists
		const existingUser = await User.findOne({ email });
		if (existingUser) {
			return res.status(400).json({ 
				success: false, 
				message: 'User with this email already exists' 
			});
		}
		
		// Create new user (generate temp password if none provided)
		const tempPassword = password || (`ExP@${Math.random().toString(36).slice(2,8)}${Date.now().toString(36).slice(-2)}`);
		const user = new User({
			name,
			email,
			password: tempPassword,
			role,
			isActive
		});
		
		await user.save();
		
		// Return user without password
		const userResponse = await User.findById(user._id)
			.select('name email role isActive isBlocked lastLogin createdAt updatedAt');
		
		// Send email with credentials if expert
		if (role === 'expert') {
			try {
				const { sendMail } = require('../scripts/mailer');
				const html = `
					<p>Hello ${name},</p>
					<p>Your expert account has been created.</p>
					<p><strong>Login:</strong> ${email}<br/><strong>Temporary password:</strong> ${tempPassword}</p>
					<p>Please login and change your password immediately using the Forgot/Reset flow if needed.</p>
				`;
				await sendMail({ to: email, subject: 'Your Expert Account Credentials', html, text: `Login: ${email}\nTemporary password: ${tempPassword}` });
			} catch (e) {
				console.error('Failed to send expert credentials email:', e);
			}
		}

		res.status(201).json({ 
			success: true, 
			user: userResponse,
			message: role === 'expert' ? 'Expert created and credentials emailed' : 'User created successfully'
		});
	} catch (error) {
		console.error('Admin create user error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Admin: crops CRUD
router.get('/crops', auth, auth.requireAdmin, async (req, res) => {
	try {
		const limit = Math.min(Number(req.query.limit) || 50, 200);
		const page = Math.max(Number(req.query.page) || 1, 1);
		const skip = (page - 1) * limit;
		const search = req.query.search;
		const filter = {};
		if (search) {
			filter.$or = [
				{ name: { $regex: search, $options: 'i' } },
				{ description: { $regex: search, $options: 'i' } }
			];
		}
		const [crops, total] = await Promise.all([
			CropProfile.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
			CropProfile.countDocuments(filter)
		]);
		res.json({ success: true, crops, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
	} catch (error) {
		console.error('Admin list crops error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

router.post('/crops', auth, auth.requireAdmin, async (req, res) => {
	try {
		const { 
			name, 
			name_ml = '', 
			description = '', 
			description_ml = '', 
			cultivationTips = [], 
			cultivationTips_ml = [], 
			imageUrl = '' 
		} = req.body;
		if (!name) {
			return res.status(400).json({ success: false, message: 'Crop name is required' });
		}
		const crop = await CropProfile.create({ 
			name, 
			name_ml, 
			description, 
			description_ml, 
			cultivationTips, 
			cultivationTips_ml, 
			imageUrl, 
			createdBy: req.user._id 
		});
		await ActionLog.create({ actor: req.user._id, action: 'crop_create', targetType: 'CropProfile', targetId: crop._id.toString() });
		res.status(201).json({ success: true, crop });
	} catch (error) {
		console.error('Admin create crop error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});
// Admin: upload crop image
router.post('/crops/:id/image', auth, auth.requireAdmin, upload.single('image'), async (req, res) => {
	try {
		if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
		const relPath = `/api/admin/uploads/${req.file.filename}`;
		const crop = await CropProfile.findByIdAndUpdate(req.params.id, { imageUrl: relPath }, { new: true });
		if (!crop) return res.status(404).json({ success: false, message: 'Crop not found' });
		res.json({ success: true, crop, imageUrl: relPath });
	} catch (error) {
		console.error('Admin upload crop image error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

router.put('/crops/:id', auth, auth.requireAdmin, async (req, res) => {
	try {
		const { name, name_ml, description, description_ml, cultivationTips, cultivationTips_ml, imageUrl } = req.body;
		const update = {};
		if (name !== undefined) update.name = name;
		if (name_ml !== undefined) update.name_ml = name_ml;
		if (description !== undefined) update.description = description;
		if (description_ml !== undefined) update.description_ml = description_ml;
		if (cultivationTips !== undefined) update.cultivationTips = cultivationTips;
		if (cultivationTips_ml !== undefined) update.cultivationTips_ml = cultivationTips_ml;
		if (imageUrl !== undefined) update.imageUrl = imageUrl;
		const crop = await CropProfile.findByIdAndUpdate(req.params.id, update, { new: true });
		if (!crop) return res.status(404).json({ success: false, message: 'Crop not found' });
		await ActionLog.create({ actor: req.user._id, action: 'crop_update', targetType: 'CropProfile', targetId: req.params.id });
		res.json({ success: true, crop });
	} catch (error) {
		console.error('Admin update crop error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

router.delete('/crops/:id', auth, auth.requireAdmin, async (req, res) => {
	try {
		const crop = await CropProfile.findByIdAndDelete(req.params.id);
		if (!crop) return res.status(404).json({ success: false, message: 'Crop not found' });
		await ActionLog.create({ actor: req.user._id, action: 'crop_delete', targetType: 'CropProfile', targetId: req.params.id });
		res.json({ success: true, message: 'Crop deleted' });
	} catch (error) {
		console.error('Admin delete crop error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Admin: CropCalendar CRUD operations
router.get('/sowing-calendar', auth, auth.requireAdmin, async (req, res) => {
	try {
		const limit = Math.min(Number(req.query.limit) || 50, 200);
		const page = Math.max(Number(req.query.page) || 1, 1);
		const skip = (page - 1) * limit;
		
		// Build search filter
		const search = req.query.search;
		const filter = {};
		if (search) {
			filter.$or = [
				{ crop: { $regex: search, $options: 'i' } },
				{ region: { $regex: search, $options: 'i' } },
				{ season: { $regex: search, $options: 'i' } }
			];
		}
		
		const [records, total] = await Promise.all([
			CropCalendar.find(filter)
				.sort({ lastUpdated: -1 })
				.skip(skip)
				.limit(limit),
			CropCalendar.countDocuments(filter)
		]);
		
		res.json({ 
			success: true, 
			records,
			pagination: {
				page,
				limit,
				total,
				pages: Math.ceil(total / limit)
			}
		});
	} catch (error) {
		console.error('Admin list sowing calendar error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

router.get('/sowing-calendar/:id', auth, auth.requireAdmin, async (req, res) => {
	try {
		const record = await CropCalendar.findById(req.params.id);
		
		if (!record) {
			return res.status(404).json({ success: false, message: 'Sowing calendar record not found' });
		}
		
		res.json({ success: true, record });
	} catch (error) {
		console.error('Admin get sowing calendar error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

router.post('/sowing-calendar', auth, auth.requireAdmin, async (req, res) => {
	try {
		const { crop, season, startMonth, endMonth, region, agroZone, notes, varieties, source } = req.body;
		
		// Validate required fields
		if (!crop || !season || !startMonth || !endMonth) {
			return res.status(400).json({ 
				success: false, 
				message: 'Crop, season, startMonth, and endMonth are required' 
			});
		}
		
		// Validate season
		if (!['Kharif', 'Rabi', 'Zaid'].includes(season)) {
			return res.status(400).json({ 
				success: false, 
				message: 'Season must be one of: Kharif, Rabi, Zaid' 
			});
		}
		
		// Ensure normalized field present to satisfy schema requirement
		const cropLower = String(crop).toLowerCase().trim();
		
		const record = await CropCalendar.create({
			crop,
			crop_lower: cropLower,
			season,
			startMonth,
			endMonth,
			region: region || 'all',
			agroZone,
			notes,
			varieties: varieties || [],
			source,
			lastUpdated: new Date(),
			version: 1
		});
		
		await ActionLog.create({ 
			actor: req.user._id, 
			action: 'sowing_calendar_create', 
			targetType: 'CropCalendar', 
			targetId: record._id.toString(),
			meta: { crop, season, region }
		});
		
		res.status(201).json({ success: true, record });
	} catch (error) {
		console.error('Admin create sowing calendar error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

router.put('/sowing-calendar/:id', auth, auth.requireAdmin, async (req, res) => {
	try {
		const { crop, season, startMonth, endMonth, region, agroZone, notes, varieties, source } = req.body;
		
		// Validate season if provided
		if (season && !['Kharif', 'Rabi', 'Zaid'].includes(season)) {
			return res.status(400).json({ 
				success: false, 
				message: 'Season must be one of: Kharif, Rabi, Zaid' 
			});
		}
		
		// Get current record for versioning
		const currentRecord = await CropCalendar.findById(req.params.id);
		if (!currentRecord) {
			return res.status(404).json({ success: false, message: 'Sowing calendar record not found' });
		}
		
		const updateData = {
			lastUpdated: new Date(),
			version: currentRecord.version + 1
		};
		
		if (crop !== undefined) updateData.crop = crop;
		if (season !== undefined) updateData.season = season;
		if (startMonth !== undefined) updateData.startMonth = startMonth;
		if (endMonth !== undefined) updateData.endMonth = endMonth;
		if (region !== undefined) updateData.region = region;
		if (agroZone !== undefined) updateData.agroZone = agroZone;
		if (notes !== undefined) updateData.notes = notes;
		if (varieties !== undefined) updateData.varieties = varieties;
		if (source !== undefined) updateData.source = source;
		
		const record = await CropCalendar.findByIdAndUpdate(
			req.params.id,
			updateData,
			{ new: true }
		);
		
		await ActionLog.create({ 
			actor: req.user._id, 
			action: 'sowing_calendar_update', 
			targetType: 'CropCalendar', 
			targetId: req.params.id,
			meta: { 
				crop: record.crop, 
				season: record.season, 
				region: record.region,
				version: record.version,
				changes: Object.keys(updateData).filter(key => key !== 'lastUpdated' && key !== 'version')
			}
		});
		
		res.json({ success: true, record });
	} catch (error) {
		console.error('Admin update sowing calendar error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

router.delete('/sowing-calendar/:id', auth, auth.requireAdmin, async (req, res) => {
	try {
		const record = await CropCalendar.findById(req.params.id);
		if (!record) {
			return res.status(404).json({ success: false, message: 'Sowing calendar record not found' });
		}
		
		await CropCalendar.findByIdAndDelete(req.params.id);
		
		await ActionLog.create({ 
			actor: req.user._id, 
			action: 'sowing_calendar_delete', 
			targetType: 'CropCalendar', 
			targetId: req.params.id,
			meta: { crop: record.crop, season: record.season, region: record.region }
		});
		
		res.json({ success: true, message: 'Sowing calendar record deleted successfully' });
	} catch (error) {
		console.error('Admin delete sowing calendar error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

// Admin: Bulk operations for sowing calendar
router.post('/sowing-calendar/bulk', auth, auth.requireAdmin, async (req, res) => {
	try {
		const { action, recordIds } = req.body;
		
		if (!['delete', 'update'].includes(action)) {
			return res.status(400).json({ success: false, message: 'Invalid action' });
		}
		
		if (!Array.isArray(recordIds) || recordIds.length === 0) {
			return res.status(400).json({ success: false, message: 'Record IDs are required' });
		}
		
		let result;
		if (action === 'delete') {
			result = await CropCalendar.deleteMany({ _id: { $in: recordIds } });
		}
		
		await ActionLog.create({ 
			actor: req.user._id, 
			action: `sowing_calendar_bulk_${action}`, 
			targetType: 'CropCalendar', 
			targetId: recordIds.join(','),
			meta: { count: result?.deletedCount || 0 }
		});
		
		res.json({ 
			success: true, 
			message: `Bulk ${action} completed`,
			affected: result?.deletedCount || 0
		});
	} catch (error) {
		console.error('Admin bulk sowing calendar error:', error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
});

module.exports = router;
// Admin: list schemes
router.get('/schemes', auth, auth.requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const includeExpired = String(req.query.includeExpired || 'false') === 'true';

    const filter = {};
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { eligibility: { $regex: search, $options: 'i' } },
        { benefits: { $regex: search, $options: 'i' } }
      ];
    }
    if (!includeExpired) {
      const today = new Date();
      filter.$or = [ ...(filter.$or || []), { endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: today } } ];
    }

    const [schemes, total] = await Promise.all([
      Scheme.find(filter).sort({ lastUpdated: -1 }).skip(skip).limit(limit),
      Scheme.countDocuments(filter)
    ]);

    return res.json({ success: true, schemes, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Admin list schemes error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});
// Admin: Government Schemes CRUD
router.post('/schemes', auth, auth.requireAdmin, async (req, res) => {
  try {
    const { title, crop = [], region = [], category = 'Other', eligibility = '', benefits = '', howToApply = '', startDate = null, endDate = null, source = '' } = req.body || {};
    if (!title) return res.status(400).json({ success: false, message: 'Scheme title is required' });
    const doc = await Scheme.create({ title, crop, region, category, eligibility, benefits, howToApply, startDate, endDate, source, lastUpdated: new Date() });
    await ActionLog.create({ actor: req.user._id, action: 'scheme_create', targetType: 'Scheme', targetId: doc._id.toString(), meta: { title, category } });
    return res.status(201).json({ success: true, scheme: doc });
  } catch (error) {
    console.error('Admin create scheme error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/schemes/:id', auth, auth.requireAdmin, async (req, res) => {
  try {
    const update = { ...req.body, lastUpdated: new Date() };
    const doc = await Scheme.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Scheme not found' });
    await ActionLog.create({ actor: req.user._id, action: 'scheme_update', targetType: 'Scheme', targetId: req.params.id, meta: { fields: Object.keys(req.body || {}) } });
    return res.json({ success: true, scheme: doc });
  } catch (error) {
    console.error('Admin update scheme error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/schemes/:id', auth, auth.requireAdmin, async (req, res) => {
  try {
    const doc = await Scheme.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Scheme not found' });
    await ActionLog.create({ actor: req.user._id, action: 'scheme_delete', targetType: 'Scheme', targetId: req.params.id, meta: { title: doc.title } });
    return res.json({ success: true, message: 'Scheme deleted' });
  } catch (error) {
    console.error('Admin delete scheme error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin: bulk upload schemes (JSON or CSV)
router.post('/schemes/bulk', auth, auth.requireAdmin, async (req, res) => {
  try {
    const { format = 'json', data } = req.body || {};
    if (!data) return res.status(400).json({ success: false, message: 'No data provided' });
    let items = [];
    if (format === 'csv') {
      // Very simple CSV parser: expects headers matching fields
      const lines = String(data).split(/\r?\n/).filter(Boolean);
      const headers = (lines.shift() || '').split(',').map(h => h.trim());
      for (const line of lines) {
        const cells = line.split(',');
        const obj = {};
        headers.forEach((h, i) => { obj[h] = cells[i] || ''; });
        // Normalize arrays for crop/region if provided as semicolon-separated
        if (typeof obj.crop === 'string') obj.crop = obj.crop.split(';').map(s => s.trim()).filter(Boolean);
        if (typeof obj.region === 'string') obj.region = obj.region.split(';').map(s => s.trim()).filter(Boolean);
        items.push(obj);
      }
    } else {
      items = Array.isArray(data) ? data : JSON.parse(data);
    }
    items = items.filter(it => it && it.title);
    if (items.length === 0) return res.status(400).json({ success: false, message: 'No valid items to import' });
    const inserted = await Scheme.insertMany(items.map(it => ({ ...it, lastUpdated: new Date() })), { ordered: false });
    await ActionLog.create({ actor: req.user._id, action: 'scheme_bulk_upload', targetType: 'Scheme', targetId: '', meta: { count: inserted.length } });
    return res.status(201).json({ success: true, inserted: inserted.length });
  } catch (error) {
    console.error('Admin bulk upload schemes error:', error);
    return res.status(500).json({ success: false, message: 'Bulk upload failed' });
  }
});

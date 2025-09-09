const express = require('express');
const { body } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const config = require('../config/config');

const router = express.Router();
const crypto = require('crypto');
const { sendMail } = require('../scripts/mailer');

// @route   POST /api/auth/signup
// @desc    Register a new user
// @access  Public
router.post('/signup', [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[A-Za-z][A-Za-z\s.'-]*$/)
    .withMessage('Name may contain letters, spaces, apostrophes, periods, and hyphens'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isStrongPassword({
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1
    })
    .withMessage('Password must be at least 8 characters and include uppercase, lowercase, number, and symbol')
    .custom((value) => !/\s/.test(value))
    .withMessage('Password cannot contain spaces'),
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match')
], validate, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create new user
    const user = new User({
      name,
      email,
      password
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
], validate, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email and include password for comparison
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Block login for deactivated users
    if (user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support for assistance.'
      });
    }

    // Block login for blocked users
    if (user.isBlocked === true) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been blocked. Please contact support for assistance.'
      });
    }

    // Update last login
    await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// @route   POST /api/auth/google
// @desc    Login/Signup with Google ID token
// @access  Public
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Missing idToken' });
    }

    // Verify token using Google's tokeninfo endpoint
    const axios = require('axios');
    const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    const { data } = await axios.get(verifyUrl);

    const email = data?.email;
    const name = data?.name || email?.split('@')[0] || 'User';
    if (!email) {
      return res.status(401).json({ success: false, message: 'Invalid Google token' });
    }

    // Find or create user
    let user = await User.findOne({ email }).select('+password');
    if (!user) {
      user = new User({ name, email, password: (Math.random().toString(36).slice(2) + Date.now().toString(36)) });
      await user.save();
    }

    // Enforce blocked/inactive
    if (user.isActive === false) {
      return res.status(401).json({ success: false, message: 'Your account has been deactivated. Please contact support for assistance.' });
    }
    if (user.isBlocked === true) {
      return res.status(401).json({ success: false, message: 'Your account has been blocked. Please contact support for assistance.' });
    }

    await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });

    const token = jwt.sign({ userId: user._id }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });
    res.json({ success: true, message: 'Login successful', token, user: { id: user._id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt } });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ success: false, message: 'Server error during Google login' });
  }
});


// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching profile'
    });
  }
});

// @route   PUT /api/auth/update-password
// @desc    Update current user's password
// @access  Private
router.put('/update-password', [
  auth,
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isStrongPassword({
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1
    })
    .withMessage('New password must be at least 8 characters and include uppercase, lowercase, number, and symbol')
    .custom((value) => !/\s/.test(value))
    .withMessage('Password cannot contain spaces'),
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage('Passwords do not match')
], validate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Get user with password field included
    const user = await User.findById(req.user._id).select('+password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating password'
    });
  }
});

// (export moved to end of file)
// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], validate, async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    // Respond with success even if not found to avoid user enumeration
    if (!user) {
      return res.json({ success: true, message: 'If the email exists, a reset link has been sent' });
    }

    // Generate token and expiry
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + (Number(config.RESET_TOKEN_EXPIRES_MIN || 60) * 60 * 1000));

    await User.findByIdAndUpdate(user._id, {
      resetPasswordToken: token,
      resetPasswordExpires: expires
    });

    const resetUrl = `${config.FRONTEND_RESET_URL}?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
    const subject = 'Reset your password';
    const html = `
      <p>Hello ${user.name || ''},</p>
      <p>You requested to reset your password. Click the button below to reset it. This link will expire in ${config.RESET_TOKEN_EXPIRES_MIN} minutes.</p>
      <p><a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">Reset Password</a></p>
      <p>If the button does not work, copy and paste this link into your browser:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you did not request this, please ignore this email.</p>
    `;
    await sendMail({ to: email, subject, html, text: `Reset your password: ${resetUrl}` });

    res.json({ success: true, message: 'If the email exists, a reset link has been sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error during password reset request' });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', [
  body('email').isEmail().normalizeEmail(),
  body('token').isString().notEmpty(),
  body('newPassword')
    .isStrongPassword({ minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1 })
    .withMessage('Password must be at least 8 characters and include uppercase, lowercase, number, and symbol'),
  body('confirmPassword').custom((value, { req }) => value === req.body.newPassword).withMessage('Passwords do not match')
], validate, async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.resetPasswordToken || !user.resetPasswordExpires) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }
    if (user.resetPasswordToken !== token || user.resetPasswordExpires < new Date()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    user.password = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ success: true, message: 'Password reset successful. You can now login.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error during password reset' });
  }
});
module.exports = router;
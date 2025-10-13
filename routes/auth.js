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
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Simple local uploads for avatars (re-uses uploads directory)
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  try { fs.mkdirSync(uploadsDir); } catch (_) {}
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `avatar_${req.user?._id || 'anon'}_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

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

    // Send welcome email
    try {
      const registrationTime = new Date().toLocaleString();
      const subject = 'Welcome to Our Platform - Account Created Successfully!';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb; text-align: center;">Welcome to Our Platform!</h2>
          <p>Hello ${user.name},</p>
          <p>Congratulations! Your account has been successfully created on <strong>${registrationTime}</strong>.</p>
          
          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
            <h3 style="color: #1e40af; margin-top: 0;">Account Details:</h3>
            <p><strong>Name:</strong> ${user.name}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Role:</strong> ${user.role}</p>
            <p><strong>Registration Date:</strong> ${registrationTime}</p>
          </div>

          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">What's Next?</h3>
            <ul style="color: #555;">
              <li>You can now log in to your account using your email and password</li>
              <li>Explore all the features available to ${user.role}s</li>
              <li>Update your profile information anytime</li>
              <li>Contact support if you need any assistance</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${config.FRONTEND_URL}/login" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Login to Your Account</a>
          </div>

          <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h4 style="color: #92400e; margin-top: 0;">🔒 Security Tips:</h4>
            <ul style="color: #92400e; margin-bottom: 0;">
              <li>Keep your password secure and don't share it with anyone</li>
              <li>Log out from shared devices after use</li>
              <li>Contact us immediately if you notice any suspicious activity</li>
            </ul>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 14px; text-align: center;">
            Thank you for joining us! If you have any questions, feel free to contact our support team.
          </p>
        </div>
      `;
      
      const text = `Welcome to Our Platform!\n\nHello ${user.name},\n\nCongratulations! Your account has been successfully created on ${registrationTime}.\n\nAccount Details:\n- Name: ${user.name}\n- Email: ${user.email}\n- Role: ${user.role}\n- Registration Date: ${registrationTime}\n\nWhat's Next?\n- You can now log in to your account using your email and password\n- Explore all the features available to ${user.role}s\n- Update your profile information anytime\n- Contact support if you need any assistance\n\nLogin to your account: ${config.FRONTEND_URL}/login\n\nSecurity Tips:\n- Keep your password secure and don't share it with anyone\n- Log out from shared devices after use\n- Contact us immediately if you notice any suspicious activity\n\nThank you for joining us! If you have any questions, feel free to contact our support team.`;
      
      await sendMail({ to: user.email, subject, html, text });
      console.log(`Welcome email sent to ${user.email}`);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail the registration if email sending fails
    }

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
        avatarUrl: user.avatarUrl,
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

    // Send login notification email
    try {
      const loginTime = new Date().toLocaleString();
      const subject = 'Login Notification - Your Account Was Accessed';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb; text-align: center;">Login Notification</h2>
          <p>Hello ${user.name},</p>
          <p>Your account was successfully accessed on <strong>${loginTime}</strong>.</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Login Details:</h3>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Time:</strong> ${loginTime}</p>
            <p><strong>Role:</strong> ${user.role}</p>
          </div>
          <p>If this was not you, please contact support immediately and consider changing your password.</p>
          <p>If this was you, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 14px;">This is an automated security notification from your account.</p>
        </div>
      `;
      const text = `Login Notification\n\nHello ${user.name},\n\nYour account was successfully accessed on ${loginTime}.\n\nLogin Details:\n- Email: ${user.email}\n- Time: ${loginTime}\n- Role: ${user.role}\n\nIf this was not you, please contact support immediately and consider changing your password.\n\nIf this was you, you can safely ignore this email.\n\nThis is an automated security notification from your account.`;
      
      await sendMail({ to: user.email, subject, html, text });
      console.log(`Login notification email sent to ${user.email}`);
    } catch (emailError) {
      console.error('Failed to send login notification email:', emailError);
      // Don't fail the login if email sending fails
    }

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
        avatarUrl: user.avatarUrl,
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

    // Send login notification email
    try {
      const loginTime = new Date().toLocaleString();
      const subject = 'Login Notification - Your Account Was Accessed';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb; text-align: center;">Login Notification</h2>
          <p>Hello ${user.name},</p>
          <p>Your account was successfully accessed on <strong>${loginTime}</strong> via Google Sign-In.</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Login Details:</h3>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Time:</strong> ${loginTime}</p>
            <p><strong>Role:</strong> ${user.role}</p>
            <p><strong>Method:</strong> Google Sign-In</p>
          </div>
          <p>If this was not you, please contact support immediately and consider changing your password.</p>
          <p>If this was you, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 14px;">This is an automated security notification from your account.</p>
        </div>
      `;
      const text = `Login Notification\n\nHello ${user.name},\n\nYour account was successfully accessed on ${loginTime} via Google Sign-In.\n\nLogin Details:\n- Email: ${user.email}\n- Time: ${loginTime}\n- Role: ${user.role}\n- Method: Google Sign-In\n\nIf this was not you, please contact support immediately and consider changing your password.\n\nIf this was you, you can safely ignore this email.\n\nThis is an automated security notification from your account.`;
      
      await sendMail({ to: user.email, subject, html, text });
      console.log(`Login notification email sent to ${user.email} (Google Sign-In)`);
    } catch (emailError) {
      console.error('Failed to send login notification email:', emailError);
      // Don't fail the login if email sending fails
    }

    const token = jwt.sign({ userId: user._id }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });
    res.json({ success: true, message: 'Login successful', token, user: { id: user._id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl, createdAt: user.createdAt } });
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

// @route   PUT /api/auth/update-profile
// @desc    Update current user's name only
// @access  Private
router.put('/update-profile', [auth, body('name').trim().isLength({ min: 2, max: 50 })], validate, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.user._id, { name: req.body.name }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Server error while updating profile' });
  }
});

// @route   POST /api/auth/upload-avatar
// @desc    Upload/replace current user's avatar
// @access  Private
router.post('/upload-avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const rel = `/api/admin/uploads/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(req.user._id, { avatarUrl: rel }, { new: true }).select('-password');
    res.json({ success: true, avatarUrl: rel, user });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ success: false, message: 'Server error while uploading avatar' });
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
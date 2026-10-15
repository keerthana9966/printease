const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

/**
 * Helper: sign a JWT token
 */
function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// ─────────────────────────────────────────────────────────
// POST /api/auth/register/customer
// Register a new CUSTOMER account
// Body: { name, email, password }
// ─────────────────────────────────────────────────────────
router.post('/register/customer', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'customer'
    });

    const token = signToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Customer account created successfully.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Register customer error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/auth/register/vendor
// Register a new VENDOR account (requires invite code)
// Body: { name, email, password, inviteCode }
// The invite code is stored in VENDOR_INVITE_CODE env var
// ─────────────────────────────────────────────────────────
router.post('/register/vendor', async (req, res) => {
  try {
    const { name, email, password, inviteCode } = req.body;

    if (!name || !email || !password || !inviteCode) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and vendor invite code are required.'
      });
    }

    // Validate vendor invite code
    if (inviteCode !== process.env.VENDOR_INVITE_CODE) {
      return res.status(403).json({
        success: false,
        message: 'Invalid vendor invite code. Contact the administrator.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    // Generate a unique vendor ID: VND-XXXX
    const vendorCount = await User.countDocuments({ role: 'vendor' });
    const vendorId = `VND-${String(vendorCount + 1).padStart(4, '0')}`;

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'vendor',
      vendorId
    });

    const token = signToken(user._id);

    res.status(201).json({
      success: true,
      message: `Vendor account created. Your Vendor ID is ${vendorId}.`,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        vendorId: user.vendorId
      }
    });
  } catch (err) {
    console.error('Register vendor error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/auth/login/customer
// Login for CUSTOMERS only
// Body: { email, password }
// ─────────────────────────────────────────────────────────
router.post('/login/customer', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Prevent vendors from logging in via customer endpoint
    if (user.role !== 'customer') {
      return res.status(403).json({
        success: false,
        message: 'This is a customer login. Please use the Vendor login instead.'
      });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = signToken(user._id);

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Customer login error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/auth/login/vendor
// Login for VENDORS only (separate endpoint)
// Body: { email, password }
// ─────────────────────────────────────────────────────────
router.post('/login/vendor', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid vendor credentials.' });
    }

    // Prevent customers from logging in via vendor endpoint
    if (user.role !== 'vendor') {
      return res.status(403).json({
        success: false,
        message: 'This is a vendor login. Please use the Customer login instead.'
      });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid vendor credentials.' });
    }

    const token = signToken(user._id);

    res.json({
      success: true,
      message: 'Vendor login successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        vendorId: user.vendorId
      }
    });
  } catch (err) {
    console.error('Vendor login error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/auth/me
// Get current logged-in user profile
// ─────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      vendorId: req.user.vendorId || null,
      createdAt: req.user.createdAt
    }
  });
});

module.exports = router;

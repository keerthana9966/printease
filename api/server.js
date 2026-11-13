// Vercel serverless API handler
// This file is the entry point for all /api/* routes on Vercel
const path = require('path');

// Load .env from project root (one level up from /api)
// On Vercel, env vars are set in the dashboard, but this helps in local testing
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dns = require('dns');

// Use IPv4 first for DNS resolution (helps with Atlas SRV lookups)
dns.setDefaultResultOrder('ipv4first');

// Fail fast on queries when disconnected instead of buffering indefinitely
mongoose.set('bufferTimeoutMS', 8000);

const app = express();

// ── CORS — allow all origins for Vercel deployment ──
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

// Handle preflight requests explicitly
app.options('*', cors());

// ── Body parsers ──
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ═══════════════════════════════════════════════════════
//  DATABASE CONNECTION (cached across warm Vercel invocations)
// ═══════════════════════════════════════════════════════
let lastDbError = null;

async function connectDB() {
  // Already connected — reuse (Vercel warm start)
  if (mongoose.connection.readyState === 1) {
    return true;
  }

  // Currently connecting — wait
  if (mongoose.connection.readyState === 2) {
    return new Promise((resolve) => {
      const onConnected = () => { cleanup(); resolve(true); };
      const onError = () => { cleanup(); resolve(false); };
      const timeout = setTimeout(() => { cleanup(); resolve(mongoose.connection.readyState === 1); }, 10000);
      function cleanup() {
        mongoose.connection.removeListener('connected', onConnected);
        mongoose.connection.removeListener('error', onError);
        clearTimeout(timeout);
      }
      mongoose.connection.once('connected', onConnected);
      mongoose.connection.once('error', onError);
    });
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    lastDbError = 'MONGODB_URI environment variable is not set. Add it in Vercel Dashboard → Settings → Environment Variables.';
    console.error('❌ MONGODB_URI is not configured');
    return false;
  }

  try {
    console.log('⏳ Connecting to MongoDB Atlas...');
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 30000,
      family: 4,
      maxPoolSize: 5,
      minPoolSize: 0,
      maxIdleTimeMS: 10000
    });
    console.log('✅ Connected to MongoDB Atlas');
    lastDbError = null;
    return true;
  } catch (err) {
    lastDbError = err.message;
    console.error('❌ MongoDB connection failed:', err.message);
    // Disconnect cleanly so next invocation retries fresh
    try { await mongoose.disconnect(); } catch (_) {}
    return false;
  }
}

// ── Ensure DB Connection for API Routes ──
app.use(async (req, res, next) => {
  // Skip DB check for health endpoint
  if (req.path === '/api/health' || req.path === '/health') {
    return next();
  }

  if (mongoose.connection.readyState !== 1) {
    const connected = await connectDB();
    if (!connected) {
      return res.status(503).json({
        success: false,
        message: 'Database connection failed. Please try again in a moment.',
        details: lastDbError || 'Unable to connect to database'
      });
    }
  }
  next();
});

// ── API Routes (paths relative to project root) ──
app.use('/api/auth',   require('../routes/auth'));
app.use('/api/orders', require('../routes/orders'));
app.use('/api/vendor', require('../routes/vendor'));

// ── Health check ──
app.get('/api/health', async (req, res) => {
  // Attempt connection on health check too, for diagnostics
  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }
  res.json({
    success: true,
    message: 'PrintEase API is running 🚀',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    details: mongoose.connection.readyState === 1 ? 'OK' : (lastDbError || 'Not connected yet'),
    environment: 'vercel-serverless',
    envCheck: {
      MONGODB_URI: process.env.MONGODB_URI ? 'set' : 'MISSING',
      JWT_SECRET: process.env.JWT_SECRET ? 'set' : 'MISSING',
      CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ? 'set' : 'MISSING',
      VENDOR_INVITE_CODE: process.env.VENDOR_INVITE_CODE ? 'set' : 'MISSING'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ success: true, message: 'API alive' });
});

// ── Global error handler ──
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

module.exports = app;

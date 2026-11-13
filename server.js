require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dns = require('dns');

// Use IPv4 first for DNS resolution (helps with Atlas SRV lookups)
dns.setDefaultResultOrder('ipv4first');

// Fail fast on queries when disconnected instead of buffering indefinitely
mongoose.set('bufferTimeoutMS', 4000);

const app = express();

// ── CORS ──
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Handle preflight requests
app.options('*', cors());

// ── Body parsers ──
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Serve static frontend ──
app.use(express.static(path.join(__dirname)));

// ═══════════════════════════════════════════════════════
//  DATABASE CONNECTION CACHE
// ═══════════════════════════════════════════════════════
let isConnecting = false;
let connectionPromise = null;
let lastDbError = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return true;
  }
  if (isConnecting && connectionPromise) {
    return connectionPromise;
  }

  isConnecting = true;
  connectionPromise = (async () => {
    lastDbError = null;

    // 1. Try MongoDB Atlas (if MONGODB_URI provided)
    if (process.env.MONGODB_URI) {
      try {
        console.log('⏳ Connecting to MongoDB Atlas...');
        await mongoose.connect(process.env.MONGODB_URI, {
          serverSelectionTimeoutMS: 8000,
          socketTimeoutMS: 30000,
          family: 4,
          maxPoolSize: 10,
          minPoolSize: 1
        });
        console.log('✅ Connected to MongoDB Atlas');
        return true;
      } catch (err) {
        lastDbError = err.message;
        console.warn('⚠️  Atlas connection failed:', err.message);
      }
    }

    // 2. Local development fallbacks (only in local dev, NOT on Vercel)
    if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
      try {
        const localUri = process.env.MONGODB_LOCAL || 'mongodb://127.0.0.1:27017/printease';
        console.log('⏳ Trying local MongoDB...');
        await mongoose.connect(localUri, { serverSelectionTimeoutMS: 3000 });
        console.log('✅ Connected to Local MongoDB');
        return true;
      } catch (err) {
        console.warn('⚠️  Local MongoDB not found:', err.message);
      }

      try {
        console.log('⚙️  Starting embedded MongoDB Memory Server (dev mode)...');
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongod = await MongoMemoryServer.create({ instance: { dbName: 'printease' } });
        await mongoose.connect(mongod.getUri());
        console.log('✅ Connected to In-Memory MongoDB (dev fallback)');
        return true;
      } catch (memErr) {
        console.error('⚠️  In-Memory MongoDB failed:', memErr.message);
      }
    }

    return false;
  })().finally(() => {
    isConnecting = false;
  });

  return connectionPromise;
}

// ── Reconnect on disconnect ──
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected. Will reconnect on next request.');
  connectionPromise = null;
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err.message);
  lastDbError = err.message;
});

// ── Ensure DB Connection for API Routes ──
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api') && req.path !== '/api/health') {
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
          success: false,
          message: 'Database connection failed. Please ensure your MongoDB Atlas cluster is active and IP whitelist includes 0.0.0.0/0.',
          details: lastDbError || 'Unable to connect to database'
        });
      }
    }
  }
  next();
});

// ── API Routes ──
app.use('/api/auth',   require('./routes/auth'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/vendor', require('./routes/vendor'));

// ── Health check ──
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'PrintEase API is running 🚀',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    details: mongoose.connection.readyState === 1 ? 'OK' : (lastDbError || 'Not connected'),
    environment: process.env.VERCEL ? 'vercel-serverless' : 'standalone'
  });
});

// ── Catch-all: serve frontend ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Global error handler ──
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// ═══════════════════════════════════════════════════════
//  SERVER START (Local / Standalone)
// ═══════════════════════════════════════════════════════
const PORT = process.env.PORT || 5000;

if (!process.env.VERCEL) {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════╗
║  🚀 PrintEase Server — http://localhost:${PORT}    ║
╠══════════════════════════════════════════════════╣
║  AUTH                                            ║
║   POST  /api/auth/register/customer              ║
║   POST  /api/auth/register/vendor                ║
║   POST  /api/auth/login/customer                 ║
║   POST  /api/auth/login/vendor                   ║
║   GET   /api/auth/me                             ║
║  ORDERS                                          ║
║   POST  /api/orders/upload     (file upload)     ║
║   POST  /api/orders/calculate  (cost preview)    ║
║   POST  /api/orders/place                        ║
║   GET   /api/orders/my                           ║
║   GET   /api/orders/track/:orderId               ║
║  VENDOR                                          ║
║   GET   /api/vendor/dashboard                    ║
║   GET   /api/vendor/orders                       ║
║   PATCH /api/vendor/orders/:id/status            ║
║   GET   /api/vendor/stats                        ║
╠══════════════════════════════════════════════════╣
║  🔑 Vendor invite: ${(process.env.VENDOR_INVITE_CODE || '').padEnd(28)}  ║
╚══════════════════════════════════════════════════╝
`);
    });
  });
}

module.exports = app;

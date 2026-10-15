require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dns = require('dns');

// Use IPv4 first for DNS resolution (helps with Atlas SRV lookups)
dns.setDefaultResultOrder('ipv4first');

const app = express();

// ── CORS ──
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

// ── Body parsers ──
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Serve static frontend ──
app.use(express.static(path.join(__dirname)));

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
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
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
//  DATABASE CONNECTION + SERVER START
// ═══════════════════════════════════════════════════════
const PORT = process.env.PORT || 5000;

const mongoOptions = {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  family: 4
};

async function startServer() {
  let connected = false;

  // ── 1. Try MongoDB Atlas ──
  if (process.env.MONGODB_URI) {
    try {
      console.log('⏳ Connecting to MongoDB Atlas...');
      await mongoose.connect(process.env.MONGODB_URI, mongoOptions);
      console.log('✅ Connected to MongoDB Atlas');
      connected = true;
    } catch (err) {
      console.warn('⚠️  Atlas failed:', err.message);
      console.log('\n📌 TO FIX ATLAS CONNECTION:');
      console.log('   1. Visit https://cloud.mongodb.com');
      console.log('   2. Click "Resume" if your cluster is paused');
      console.log('   3. Go to Network Access → Add IP Address → 0.0.0.0/0 (allow all)');
      console.log('   4. Wait 1-2 minutes, then restart this server\n');
    }
  }

  // ── 2. Try Local MongoDB ──
  if (!connected) {
    try {
      const localUri = process.env.MONGODB_LOCAL || 'mongodb://127.0.0.1:27017/printease';
      console.log('⏳ Trying local MongoDB...');
      await mongoose.connect(localUri, { ...mongoOptions, serverSelectionTimeoutMS: 3000 });
      console.log('✅ Connected to Local MongoDB');
      connected = true;
    } catch (err) {
      console.warn('⚠️  Local MongoDB not found:', err.message);
    }
  }

  // ── 3. Fallback: In-Memory MongoDB (development) ──
  if (!connected) {
    console.log('⚙️  Starting embedded MongoDB Memory Server (dev mode)...');
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create({
        instance: { dbName: 'printease' }
      });
      const memUri = mongod.getUri();
      await mongoose.connect(memUri, mongoOptions);
      console.log('✅ Connected to In-Memory MongoDB (dev fallback)');
      console.log('⚠️  Data will reset when server restarts. Fix Atlas for persistence.\n');
      connected = true;

      // Shut down memory server gracefully
      process.on('SIGINT', async () => {
        await mongod.stop();
        process.exit(0);
      });
    } catch (memErr) {
      console.error('❌ Memory server failed:', memErr.message);
    }
  }

  if (!connected) {
    console.error('\n❌ Could not connect to any MongoDB. Server cannot start.');
    process.exit(1);
  }

  // ── Start HTTP server ──
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
}

startServer();

module.exports = app;

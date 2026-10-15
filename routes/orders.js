const express = require('express');
const router = express.Router();
const multer = require('multer');
const streamifier = require('streamifier');
const cloudinary = require('../config/cloudinary');
const pdfParse = require('pdf-parse');
const Order = require('../models/Order');
const { authenticate, customerOnly } = require('../middleware/auth');

// ── Multer (memory storage — we stream to Cloudinary ourselves) ──
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword', 'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, DOC, PPT, PPTX files are allowed.'));
    }
  }
});

// ── Pricing constants ──
const PRICE = {
  bw: 2.5,
  color: 12.0
};
const BINDING_COST = {
  none: 0,
  spiral: 15,
  staple: 10,
  comb: 25
};

/**
 * Calculate print cost
 */
function calculateCost({ printType, pages, copies, sides, binding }) {
  const pricePerPage = PRICE[printType] || PRICE.bw;
  const sideMultiplier = sides === 'double' ? 0.5 : 1;
  const pageCost = Math.ceil(pricePerPage * pages * copies * sideMultiplier * 100) / 100;
  const bindCost = BINDING_COST[binding] || 0;
  const totalAmount = Math.round((pageCost + bindCost) * 100) / 100;
  return { pageCost, bindingCost: bindCost, totalAmount };
}

/**
 * Upload buffer to Cloudinary as raw resource
 */
function uploadToCloudinary(buffer, originalName) {
  return new Promise((resolve, reject) => {
    const folder = 'printease/documents';
    const publicId = `${folder}/${Date.now()}-${originalName.replace(/\s+/g, '_')}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        public_id: publicId,
        use_filename: true,
        unique_filename: false
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

/**
 * Get page count from PDF buffer
 * For non-PDF files we estimate 1 page per 5KB
 */
async function getPageCount(buffer, mimetype) {
  if (mimetype === 'application/pdf') {
    try {
      const data = await pdfParse(buffer);
      return data.numpages || 1;
    } catch (e) {
      console.warn('PDF parse failed, estimating pages:', e.message);
      return Math.max(1, Math.ceil(buffer.length / (5 * 1024)));
    }
  }
  // For DOCX/PPTX — estimate by size (rough: ~5KB per page)
  return Math.max(1, Math.ceil(buffer.length / (5 * 1024)));
}

// ─────────────────────────────────────────────────────────
// POST /api/orders/upload
// Upload file and get page count + estimated cost
// Requires: customer login
// Multipart: file field = 'document'
// ─────────────────────────────────────────────────────────
router.post('/upload', authenticate, customerOnly, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const buffer = req.file.buffer;
    const mimetype = req.file.mimetype;
    const originalName = req.file.originalname;

    // Count pages
    const pageCount = await getPageCount(buffer, mimetype);

    // Upload to Cloudinary
    const uploadResult = await uploadToCloudinary(buffer, originalName);

    res.json({
      success: true,
      message: 'File uploaded successfully.',
      data: {
        fileUrl: uploadResult.secure_url,
        filePublicId: uploadResult.public_id,
        fileName: originalName,
        pageCount,
        fileSizeMB: Math.round((req.file.size / 1024 / 1024) * 100) / 100
      }
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: err.message || 'File upload failed.' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/orders/calculate
// Calculate cost for given preferences (no file needed)
// Body: { printType, pages, copies, sides, binding }
// ─────────────────────────────────────────────────────────
router.post('/calculate', (req, res) => {
  try {
    const { printType = 'bw', pages = 1, copies = 1, sides = 'single', binding = 'none' } = req.body;

    if (isNaN(pages) || pages < 1) {
      return res.status(400).json({ success: false, message: 'Invalid page count.' });
    }

    const cost = calculateCost({ printType, pages: Number(pages), copies: Number(copies), sides, binding });

    res.json({
      success: true,
      data: {
        ...cost,
        breakdown: {
          pricePerPage: PRICE[printType] || PRICE.bw,
          pages: Number(pages),
          copies: Number(copies),
          sides,
          sideMultiplier: sides === 'double' ? 0.5 : 1,
          binding,
          bindingCost: BINDING_COST[binding] || 0
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Calculation failed.' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/orders/place
// Place a new print order
// Requires: customer login
// Body: { fileUrl, filePublicId, fileName, pageCount, printType, copies, pageRange,
//         pageSize, binding, sides, pickupSlot }
// ─────────────────────────────────────────────────────────
router.post('/place', authenticate, customerOnly, async (req, res) => {
  try {
    const {
      fileUrl, filePublicId, fileName, pageCount,
      printType = 'bw', copies = 1, pageRange = 'All pages',
      pageSize = 'A4', binding = 'none', sides = 'single',
      pickupSlot
    } = req.body;

    // Validate required fields
    if (!fileUrl || !fileName) {
      return res.status(400).json({ success: false, message: 'File information is required. Please upload a file first.' });
    }
    if (!pickupSlot) {
      return res.status(400).json({ success: false, message: 'Please select a pickup time slot.' });
    }
    if (!pageCount || pageCount < 1) {
      return res.status(400).json({ success: false, message: 'Invalid page count.' });
    }

    // Calculate cost
    const { pageCost, bindingCost, totalAmount } = calculateCost({
      printType,
      pages: Number(pageCount),
      copies: Number(copies),
      sides,
      binding
    });

    // Create order
    const order = await Order.create({
      customer: req.user._id,
      customerName: req.user.name,
      customerEmail: req.user.email,
      fileUrl,
      filePublicId: filePublicId || '',
      fileName,
      pageCount: Number(pageCount),
      printType,
      copies: Number(copies),
      pageRange,
      pageSize,
      binding,
      sides,
      pickupSlot,
      pageCost,
      bindingCost,
      totalAmount,
      status: 'pending',
      paymentStatus: 'paid' // Assume UPI payment done on frontend before placing
    });

    res.status(201).json({
      success: true,
      message: 'Order placed successfully!',
      data: {
        orderId: order.orderId,
        totalAmount: order.totalAmount,
        status: order.status,
        pickupSlot: order.pickupSlot,
        pageCount: order.pageCount
      }
    });
  } catch (err) {
    console.error('Place order error:', err);
    res.status(500).json({ success: false, message: 'Failed to place order. ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/orders/my
// Get all orders for the logged-in customer
// Requires: customer login
// ─────────────────────────────────────────────────────────
router.get('/my', authenticate, customerOnly, async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user._id })
      .sort({ createdAt: -1 })
      .select('-__v');

    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch orders.' });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/orders/track/:orderId
// Track an order by order ID (public — no auth required)
// ─────────────────────────────────────────────────────────
router.get('/track/:orderId', async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId })
      .select('orderId customerName status pickupSlot pageCount printType binding copies totalAmount createdAt updatedAt');

    if (!order) {
      return res.status(404).json({ success: false, message: `Order ${req.params.orderId} not found.` });
    }

    // Map status to step index
    const statusSteps = { pending: 1, printing: 2, ready: 3, collected: 4 };

    res.json({
      success: true,
      data: {
        ...order.toObject(),
        currentStep: statusSteps[order.status] || 1
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to track order.' });
  }
});

module.exports = router;

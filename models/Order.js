const mongoose = require('mongoose');

// Auto-generate order ID like PE-2024-0001
async function generateOrderId() {
  const count = await mongoose.model('Order').countDocuments();
  const year = new Date().getFullYear();
  const seq = String(count + 1).padStart(4, '0');
  return `PE-${year}-${seq}`;
}

const orderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true },

  // Who placed the order
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },

  // Uploaded file info
  fileUrl: { type: String, required: true },        // Cloudinary secure URL
  fileName: { type: String, required: true },       // Original file name
  filePublicId: { type: String, default: '' },       // Cloudinary public id (for raw files)
  pageCount: { type: Number, required: true, default: 1 },

  // Print preferences
  printType: { type: String, enum: ['bw', 'color'], default: 'bw' },
  copies: { type: Number, default: 1, min: 1, max: 50 },
  pageRange: { type: String, default: 'All pages' },
  pageSize: { type: String, enum: ['A4', 'A3', 'Letter'], default: 'A4' },
  binding: {
    type: String,
    enum: ['none', 'spiral', 'staple', 'comb'],
    default: 'none'
  },
  sides: { type: String, enum: ['single', 'double'], default: 'single' },
  pickupSlot: { type: String, required: true },       // e.g. "10:00 AM"

  // Cost breakdown
  pageCost: { type: Number, default: 0 },            // cost for pages only
  bindingCost: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },

  // Status: pending → printing → ready → collected
  status: {
    type: String,
    enum: ['pending', 'printing', 'ready', 'collected'],
    default: 'pending'
  },

  // Payment
  paymentStatus: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  paymentRef: { type: String, default: '' },

  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Auto-assign orderId before saving
orderSchema.pre('save', async function (next) {
  if (!this.orderId) {
    this.orderId = await generateOrderId();
  }
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Order', orderSchema);

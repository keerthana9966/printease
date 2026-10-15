const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { authenticate, vendorOnly } = require('../middleware/auth');

// All vendor routes require vendor authentication
router.use(authenticate, vendorOnly);

// ─────────────────────────────────────────────────────────
// GET /api/vendor/orders
// Get ALL orders for the vendor dashboard
// Query params: status (pending|printing|ready|collected), date (today|all)
// ─────────────────────────────────────────────────────────
router.get('/orders', async (req, res) => {
  try {
    const { status, date = 'all', page = 1, limit = 50 } = req.query;

    const filter = {};

    if (status && ['pending', 'printing', 'ready', 'collected'].includes(status)) {
      filter.status = status;
    }

    if (date === 'today') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select('-__v'),
      Order.countDocuments(filter)
    ]);

    res.json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: orders
    });
  } catch (err) {
    console.error('Vendor orders error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch orders.' });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/vendor/dashboard
// Dashboard summary metrics + today's queue
// ─────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const todayFilter = { createdAt: { $gte: startOfDay, $lte: endOfDay } };

    // Run all queries in parallel
    const [
      todayOrders,
      pendingOrders,
      printingOrders,
      readyOrders,
      revenueResult,
      activeQueue,
      recentAll
    ] = await Promise.all([
      Order.countDocuments(todayFilter),
      Order.countDocuments({ ...todayFilter, status: 'pending' }),
      Order.countDocuments({ ...todayFilter, status: 'printing' }),
      Order.countDocuments({ ...todayFilter, status: 'ready' }),
      Order.aggregate([
        { $match: { ...todayFilter, paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      // Active queue: pending + printing orders today, sorted by pickup slot
      Order.find({
        ...todayFilter,
        status: { $in: ['pending', 'printing', 'ready'] }
      })
        .sort({ pickupSlot: 1, createdAt: 1 })
        .select('orderId customerName customerEmail status pickupSlot pageCount printType binding copies sides totalAmount fileName fileUrl createdAt'),
      // Recent orders (all statuses)
      Order.find(todayFilter)
        .sort({ createdAt: -1 })
        .limit(20)
        .select('orderId customerName status pickupSlot pageCount printType totalAmount createdAt')
    ]);

    const todayRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    // Hourly breakdown for bar chart (9AM to 6PM)
    const hourlyData = await Order.aggregate([
      { $match: todayFilter },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill all hours 9-18
    const hours = {};
    for (let h = 9; h <= 18; h++) hours[h] = { count: 0, revenue: 0 };
    hourlyData.forEach(h => {
      if (hours[h._id] !== undefined) {
        hours[h._id] = { count: h.count, revenue: h.revenue };
      }
    });

    res.json({
      success: true,
      data: {
        metrics: {
          todayOrders,
          pendingOrders,
          printingOrders,
          readyOrders,
          collectedOrders: todayOrders - pendingOrders - printingOrders - readyOrders,
          todayRevenue: Math.round(todayRevenue * 100) / 100
        },
        activeQueue,
        recentOrders: recentAll,
        hourlyChart: hours
      }
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard data.' });
  }
});

// ─────────────────────────────────────────────────────────
// PATCH /api/vendor/orders/:orderId/status
// Update order status (vendor action)
// Body: { status: 'pending' | 'printing' | 'ready' | 'collected' }
// ─────────────────────────────────────────────────────────
router.patch('/orders/:orderId/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'printing', 'ready', 'collected'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) {
      return res.status(404).json({ success: false, message: `Order ${req.params.orderId} not found.` });
    }

    order.status = status;
    order.updatedAt = new Date();
    await order.save();

    res.json({
      success: true,
      message: `Order ${order.orderId} status updated to "${status}".`,
      data: {
        orderId: order.orderId,
        status: order.status,
        updatedAt: order.updatedAt
      }
    });
  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).json({ success: false, message: 'Failed to update order status.' });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/vendor/orders/:orderId
// Get full details of a specific order
// ─────────────────────────────────────────────────────────
router.get('/orders/:orderId', async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId }).select('-__v');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch order details.' });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/vendor/stats
// Revenue & order stats (weekly/monthly)
// ─────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const { period = 'week' } = req.query;

    const now = new Date();
    let startDate;
    if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      // default: last 7 days
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
    }

    const [dailyStats, statusBreakdown, topAmounts] = await Promise.all([
      Order.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            orders: { $sum: 1 },
            revenue: { $sum: '$totalAmount' },
            pages: { $sum: '$pageCount' }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Order.find({ createdAt: { $gte: startDate } })
        .sort({ totalAmount: -1 })
        .limit(5)
        .select('orderId customerName totalAmount printType pageCount createdAt')
    ]);

    res.json({
      success: true,
      data: {
        period,
        startDate,
        dailyStats,
        statusBreakdown,
        topOrders: topAmounts
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch stats.' });
  }
});

module.exports = router;

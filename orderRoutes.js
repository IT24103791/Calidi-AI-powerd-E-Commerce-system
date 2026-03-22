const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const {
  calculateDiscount,
  calculatePoints,
  calculateTier,
  getDeliveryFee,
  getTierInfo,
} = require("../services/loyaltyService");

// Generate unique order ID
function generateOrderId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${ts}-${rand}`;
}

// POST /api/orders - Create order from cart
router.post("/", protect, async (req, res) => {
  try {
    const { items, shippingAddress } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: "No items provided" });
    }
    if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.street) {
      return res.status(400).json({ error: "Shipping address is required" });
    }

    // Validate stock and build order items
    const orderItems = [];
    let subtotal = 0;
    let totalItemCount = 0;

    for (const item of items) {
      const product = await Product.findOne({ p_id: item.productId });
      if (!product) {
        return res.status(400).json({ error: `Product ${item.productId} not found` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({
          error: `Insufficient stock for "${product.name}". Available: ${product.stock}`,
        });
      }

      orderItems.push({
        productId: product.p_id,
        name: product.name,
        size: item.size,
        quantity: item.quantity,
        unitPrice: product.price,
      });

      subtotal += product.price * item.quantity;
      totalItemCount += item.quantity;
    }

    // Calculate loyalty discount
    const user = await User.findOne({ email: req.user.email });
    const tier = user.loyaltyTier || "none";
    const discount = calculateDiscount(tier, subtotal);
    const deliveryFee = getDeliveryFee(totalItemCount);
    const total = subtotal - discount + deliveryFee;
    const loyaltyPointsEarned = calculatePoints(total);

    // Decrement stock
    for (const item of orderItems) {
      await Product.updateOne(
        { p_id: item.productId },
        { $inc: { stock: -item.quantity } }
      );
    }

    // Create order with 15-minute expiry
    const order = await Order.create({
      orderId: generateOrderId(),
      userId: req.user.uid,
      userEmail: req.user.email,
      items: orderItems,
      shippingAddress,
      subtotal,
      discount,
      deliveryFee,
      total,
      loyaltyPointsEarned,
      loyaltyTierAtPurchase: tier,
      status: "pending",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    res.status(201).json(order);
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// POST /api/orders/:orderId/pay - Simulate payment
router.post("/:orderId/pay", protect, async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.userId !== req.user.uid) {
      return res.status(403).json({ error: "Not authorized" });
    }
    if (order.status !== "pending") {
      return res.status(400).json({ error: `Cannot pay for ${order.status} order` });
    }
    if (new Date(order.expiresAt) < new Date()) {
      order.status = "expired";
      await order.save();
      // Restore stock
      for (const item of order.items) {
        await Product.updateOne(
          { p_id: item.productId },
          { $inc: { stock: item.quantity } }
        );
      }
      return res.status(400).json({ error: "Order has expired" });
    }

    // Mark as paid
    order.status = "paid";
    order.paidAt = new Date();
    await order.save();

    // Update user loyalty
    const user = await User.findOne({ email: req.user.email });
    user.totalOrders += 1;
    user.loyaltyPoints += order.loyaltyPointsEarned;
    user.loyaltyTier = calculateTier(user.totalOrders);
    await user.save();

    res.json({
      order,
      loyaltyUpdate: {
        pointsEarned: order.loyaltyPointsEarned,
        totalPoints: user.loyaltyPoints,
        tier: user.loyaltyTier,
        totalOrders: user.totalOrders,
      },
    });
  } catch (err) {
    console.error("Pay order error:", err);
    res.status(500).json({ error: "Payment failed" });
  }
});

// POST /api/orders/:orderId/cancel - Cancel order and restore stock
router.post("/:orderId/cancel", protect, async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.userId !== req.user.uid) {
      return res.status(403).json({ error: "Not authorized" });
    }
    if (order.status !== "pending") {
      return res.status(400).json({ error: `Cannot cancel ${order.status} order` });
    }

    // Restore stock
    for (const item of order.items) {
      await Product.updateOne(
        { p_id: item.productId },
        { $inc: { stock: item.quantity } }
      );
    }

    order.status = "cancelled";
    await order.save();

    res.json(order);
  } catch (err) {
    console.error("Cancel order error:", err);
    res.status(500).json({ error: "Failed to cancel order" });
  }
});

// GET /api/orders - User's orders
router.get("/", protect, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.uid }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// GET /api/orders/:orderId - Single order detail
router.get("/:orderId", protect, async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.userId !== req.user.uid && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

// GET /api/orders/:orderId/invoice - Generate invoice data
router.get("/:orderId/invoice", protect, async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.userId !== req.user.uid && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const invoice = {
      invoiceNumber: `INV-${order.orderId}`,
      date: order.paidAt || order.createdAt,
      order: {
        orderId: order.orderId,
        status: order.status,
        items: order.items,
        subtotal: order.subtotal,
        discount: order.discount,
        deliveryFee: order.deliveryFee,
        total: order.total,
      },
      customer: {
        email: order.userEmail,
        ...order.shippingAddress.toObject(),
      },
      loyaltyInfo: {
        tierAtPurchase: order.loyaltyTierAtPurchase,
        pointsEarned: order.loyaltyPointsEarned,
      },
      company: {
        name: "CALIDI - Women's Clothing",
        address: "123 Fashion Avenue, Colombo, Sri Lanka",
      },
    };

    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: "Failed to generate invoice" });
  }
});

// GET /api/orders/loyalty/info - Get loyalty info for checkout preview
router.get("/loyalty/info", protect, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email });
    const tierInfo = getTierInfo(user.loyaltyTier);
    res.json({
      tier: user.loyaltyTier,
      tierInfo,
      points: user.loyaltyPoints,
      totalOrders: user.totalOrders,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch loyalty info" });
  }
});

module.exports = router;

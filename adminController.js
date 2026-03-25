const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");
const mongoose = require("mongoose");

// GET /api/admin/dashboard/stats
exports.getDashboardStats = async (req, res) => {
  try {
    const [totalProducts, lowStockCount, orderStats, totalOrders] = await Promise.all([
      Product.countDocuments({ image_id: { $exists: true, $ne: null } }),
      Product.countDocuments({
        $expr: { $lte: ["$stock", "$lowStockThreshold"] },
        image_id: { $exists: true, $ne: null },
      }),
      Order.aggregate([
        { $match: { status: "paid" } },
        { $group: { _id: null, totalRevenue: { $sum: "$total" } } },
      ]),
      Order.countDocuments(),
    ]);

    res.json({
      totalProducts,
      lowStockCount,
      totalRevenue: orderStats[0]?.totalRevenue || 0,
      totalOrders,
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
};

// GET /api/admin/dashboard/sales?period=30
exports.getSalesData = async (req, res) => {
  try {
    const days = parseInt(req.query.period) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const salesData = await Order.aggregate([
      { $match: { status: "paid", paidAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } },
          revenue: { $sum: "$total" },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { date: "$_id", revenue: 1, orderCount: 1, _id: 0 } },
    ]);

    res.json(salesData);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch sales data" });
  }
};

// GET /api/admin/products
exports.getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || "";
    const category = req.query.category || "";

    const filter = { image_id: { $exists: true, $ne: null } };
    if (search) filter.name = { $regex: search, $options: "i" };
    if (category) filter.category = category;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort({ p_id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    res.json({ products, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
};

// POST /api/admin/products
exports.createProduct = async (req, res) => {
  try {
    const { name, description, brand, colour, price, category, stock, lowStockThreshold } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: "Name and price are required" });
    }
    if (price < 0) {
      return res.status(400).json({ error: "Price cannot be negative" });
    }
    if (stock !== undefined && stock < 0) {
      return res.status(400).json({ error: "Stock cannot be negative" });
    }

    // Generate next p_id
    const lastProduct = await Product.findOne().sort({ p_id: -1 });
    const nextPId = (lastProduct?.p_id || 0) + 1;

    let imageId = null;

    // Handle image upload via GridFS
    if (req.file) {
      const db = mongoose.connection.db;
      const bucket = new mongoose.mongo.GridFSBucket(db);
      const uploadStream = bucket.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
      });
      uploadStream.end(req.file.buffer);
      imageId = uploadStream.id;
    }

    const product = await Product.create({
      p_id: nextPId,
      name,
      description: description || "",
      brand: brand || "",
      colour: colour || "",
      price: parseFloat(price),
      category: category || "",
      stock: parseInt(stock) || 50,
      lowStockThreshold: parseInt(lowStockThreshold) || 10,
      image_id: imageId,
    });

    res.status(201).json(product);
  } catch (err) {
    console.error("Create product error:", err);
    res.status(500).json({ error: "Failed to create product" });
  }
};

// PUT /api/admin/products/:p_id
exports.updateProduct = async (req, res) => {
  try {
    const p_id = Number(req.params.p_id);
    const updates = {};
    const allowed = ["name", "description", "brand", "colour", "price", "category", "stock", "lowStockThreshold"];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = key === "price" ? parseFloat(req.body[key]) :
                       ["stock", "lowStockThreshold"].includes(key) ? parseInt(req.body[key]) :
                       req.body[key];
      }
    }

    if (updates.price !== undefined && updates.price < 0) {
      return res.status(400).json({ error: "Price cannot be negative" });
    }
    if (updates.stock !== undefined && updates.stock < 0) {
      return res.status(400).json({ error: "Stock cannot be negative" });
    }

    const product = await Product.findOneAndUpdate({ p_id }, updates, { new: true });
    if (!product) return res.status(404).json({ error: "Product not found" });

    res.json(product);
  } catch (err) {
    res.status(500).json({ error: "Failed to update product" });
  }
};

// GET /api/admin/products/low-stock
exports.getLowStockProducts = async (req, res) => {
  try {
    const products = await Product.find({
      $expr: { $lte: ["$stock", "$lowStockThreshold"] },
      image_id: { $exists: true, $ne: null },
    }).sort({ stock: 1 });

    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch low stock products" });
  }
};

// GET /api/admin/orders
exports.getOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;

    const filter = {};
    if (status) filter.status = status;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Order.countDocuments(filter),
    ]);

    res.json({ orders, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

// PUT /api/admin/orders/:orderId/status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "paid", "expired", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).json({ error: "Order not found" });

    // If cancelling or expiring, restore stock
    if ((status === "cancelled" || status === "expired") && order.status === "pending") {
      for (const item of order.items) {
        await Product.updateOne(
          { p_id: item.productId },
          { $inc: { stock: item.quantity } }
        );
      }
    }

    order.status = status;
    if (status === "paid") order.paidAt = new Date();
    await order.save();

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: "Failed to update order status" });
  }
};

// GET /api/admin/customers
exports.getCustomers = async (req, res) => {
  try {
    const customers = await User.find({ role: "customer" })
      .select("email role loyaltyTier loyaltyPoints totalOrders createdAt")
      .sort({ totalOrders: -1 });

    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customers" });
  }
};

// GET /api/admin/reports/sales
exports.getSalesReport = async (req, res) => {
  try {
    const startDate = req.query.start ? new Date(req.query.start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.end ? new Date(req.query.end) : new Date();

    const [categoryBreakdown, summary] = await Promise.all([
      Order.aggregate([
        { $match: { status: "paid", paidAt: { $gte: startDate, $lte: endDate } } },
        { $unwind: "$items" },
        {
          $lookup: {
            from: "products",
            localField: "items.productId",
            foreignField: "p_id",
            as: "product",
          },
        },
        { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$product.category",
            revenue: { $sum: { $multiply: ["$items.unitPrice", "$items.quantity"] } },
            itemsSold: { $sum: "$items.quantity" },
          },
        },
        { $project: { category: { $ifNull: ["$_id", "Unknown"] }, revenue: 1, itemsSold: 1, _id: 0 } },
      ]),
      Order.aggregate([
        { $match: { status: "paid", paidAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$total" },
            totalOrders: { $sum: 1 },
            avgOrderValue: { $avg: "$total" },
          },
        },
      ]),
    ]);

    res.json({
      categoryBreakdown,
      summary: summary[0] || { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 },
      period: { start: startDate, end: endDate },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate sales report" });
  }
};

// GET /api/admin/reports/stock
exports.getStockReport = async (req, res) => {
  try {
    const [distribution, products] = await Promise.all([
      Product.aggregate([
        { $match: { image_id: { $exists: true, $ne: null } } },
        {
          $project: {
            status: {
              $cond: [
                { $eq: ["$stock", 0] }, "Out of Stock",
                { $cond: [{ $lte: ["$stock", "$lowStockThreshold"] }, "Low Stock", "In Stock"] },
              ],
            },
          },
        },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { status: "$_id", count: 1, _id: 0 } },
      ]),
      Product.find({ image_id: { $exists: true, $ne: null } })
        .select("p_id name brand category stock lowStockThreshold")
        .sort({ stock: 1 })
        .limit(100),
    ]);

    res.json({ distribution, products });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate stock report" });
  }
};

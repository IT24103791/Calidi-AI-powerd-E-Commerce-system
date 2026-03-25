const express = require("express");
const router = express.Router();
const multer = require("multer");
const { protect } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/admin");
const admin = require("../controllers/adminController");

// Multer config for image uploads (memory storage for GridFS)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// All admin routes require auth + admin role
router.use(protect, requireAdmin);

// Dashboard
router.get("/dashboard/stats", admin.getDashboardStats);
router.get("/dashboard/sales", admin.getSalesData);

// Products
router.get("/products", admin.getProducts);
router.get("/products/low-stock", admin.getLowStockProducts);
router.post("/products", upload.single("image"), admin.createProduct);
router.put("/products/:p_id", admin.updateProduct);

// Orders
router.get("/orders", admin.getOrders);
router.put("/orders/:orderId/status", admin.updateOrderStatus);

// Customers
router.get("/customers", admin.getCustomers);

// Reports
router.get("/reports/sales", admin.getSalesReport);
router.get("/reports/stock", admin.getStockReport);

module.exports = router;

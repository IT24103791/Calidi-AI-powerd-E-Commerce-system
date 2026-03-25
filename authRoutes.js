const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");

// GET /api/auth/me - returns the current authenticated user info
router.get("/me", protect, (req, res) => {
  res.json({
    user: {
      id: req.user.uid,
      email: req.user.email,
      role: req.user.role,
      loyaltyTier: req.user.loyaltyTier,
      loyaltyPoints: req.user.loyaltyPoints,
      totalOrders: req.user.totalOrders,
    },
  });
});

module.exports = router;

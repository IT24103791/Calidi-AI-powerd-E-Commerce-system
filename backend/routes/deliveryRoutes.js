const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const Delivery = require("../models/Delivery");
const Order = require("../models/Order");


router.get("/", protect, async (req, res) => {
  try {
    const deliveries = await Delivery.find({ userId: req.user.uid }).sort({
      createdAt: -1,
    });
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch deliveries" });
  }
});


router.get("/:deliveryId", protect, async (req, res) => {
  try {
    const delivery = await Delivery.findOne({
      deliveryId: req.params.deliveryId,
    });
    if (!delivery) return res.status(404).json({ error: "Delivery not found" });
    if (delivery.userId !== req.user.uid && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }
    res.json(delivery);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch delivery" });
  }
});


router.get("/order/:orderId", protect, async (req, res) => {
  try {
    const delivery = await Delivery.findOne({ orderId: req.params.orderId });
    if (!delivery) return res.status(404).json({ error: "Delivery not found" });
    if (delivery.userId !== req.user.uid && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }
    res.json(delivery);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch delivery" });
  }
});


router.get("/methods/available", async (req, res) => {
  const city = (req.query.city || "").toLowerCase();

  
  const sameDayCities = ["colombo", "dehiwala", "moratuwa", "negombo", "kandy"];
 
  const expressCities = [
    ...sameDayCities,
    "galle", "matara", "jaffna", "batticaloa", "trincomalee",
    "anuradhapura", "kurunegala", "ratnapura", "badulla", "nuwara eliya",
  ];

  const methods = [
    {
      id: "standard",
      name: "Standard Delivery",
      description: "5-7 business days",
      fee: 350,
      available: true,
    },
    {
      id: "express",
      name: "Express Delivery",
      description: "2-3 business days",
      fee: 750,
      available: expressCities.includes(city) || !city,
    },
    {
      id: "same-day",
      name: "Same-Day Delivery",
      description: "Delivered today (order before 2 PM)",
      fee: 1500,
      available: sameDayCities.includes(city),
    },
  ];

  res.json(methods);
});

module.exports = router;

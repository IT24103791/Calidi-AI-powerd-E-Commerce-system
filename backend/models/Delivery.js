const mongoose = require("mongoose");

const deliverySchema = new mongoose.Schema(
  {
    deliveryId: {
      type: String,
      unique: true,
      required: true,
    },
    orderId: { type: String, required: true },
    userId: { type: String, required: true },
    userEmail: { type: String, required: true },

    
    recipientName: { type: String, required: true },
    contactNumber: { type: String, required: true },
    deliveryAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zip: { type: String, required: true },
      country: { type: String, required: true },
    },
    deliveryNotes: { type: String, default: "" },

    
    deliveryMethod: {
      type: String,
      enum: ["standard", "express", "same-day"],
      default: "standard",
    },
    deliveryFee: { type: Number, default: 0 },

    
    scheduledDate: { type: Date, default: null },
    scheduledTimeSlot: {
      type: String,
      enum: ["morning", "afternoon", "evening", "any"],
      default: "any",
    },

    
    status: {
      type: String,
      enum: [
        "pending_pickup",
        "in_transit",
        "delivered",
        "failed",
        "returned",
      ],
      default: "pending_pickup",
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        note: { type: String, default: "" },
      },
    ],

    
    deliveredAt: { type: Date, default: null },
    proofOfDelivery: { type: String, default: "" },

    
    itemCount: { type: Number, default: 0 },
    orderTotal: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Delivery", deliverySchema);

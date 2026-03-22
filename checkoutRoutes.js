const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const Stripe = require("stripe");

// POST /api/checkout/create-session
router.post("/create-session", protect, async (req, res) => {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { lineItems, shippingAddress } = req.body;

    if (!lineItems?.length) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    const stripeLineItems = lineItems.map((item) => ({
      price_data: {
        currency: "lkr",
        product_data: { name: item.name },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    const customers = await stripe.customers.list({ email: req.user.email, limit: 1 });
    const customerId = customers.data[0]?.id;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : req.user.email,
      line_items: stripeLineItems,
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/payment-success`,
      cancel_url: `${process.env.CLIENT_URL}/payment-canceled`,
      metadata: {
        shipping_name: shippingAddress?.fullName || "",
        shipping_street: shippingAddress?.street || "",
        shipping_city: shippingAddress?.city || "",
        shipping_state: shippingAddress?.state || "",
        shipping_zip: shippingAddress?.zip || "",
        shipping_country: shippingAddress?.country || "",
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

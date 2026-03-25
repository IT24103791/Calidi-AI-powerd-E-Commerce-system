const express = require('express');
const router = express.Router();
const axios = require('axios');
const mongoose = require('mongoose');

const IMAGE_BASE = 'http://127.0.0.1:5000/api/products/image';

// Helper: stream all GridFS chunks for an image_id and return a Buffer
async function getImageBuffer(image_id) {
  if (!image_id) return null;
  const chunks = await mongoose.connection.db.collection('fs.chunks')
    .find({ files_id: image_id })
    .sort({ n: 1 })
    .toArray();
  if (!chunks.length) return null;
  return Buffer.concat(chunks.map(c => Buffer.isBuffer(c.data) ? c.data : Buffer.from(c.data.buffer)));
}

// Helper: strip HTML tags from description strings
function stripHtml(str) {
  if (!str) return "";
  return str.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

// Route for: GET /api/products
router.get('/', async (req, res) => {
  try {
    // Only return products that have an image stored in GridFS
    // Sort by newest first (highest p_id = most recently added)
    const products = await mongoose.connection.db.collection('products')
      .find({ image_id: { $exists: true, $ne: null } })
      .sort({ p_id: -1 })
      .limit(200)
      .toArray();

    const result = products.map((product) => ({
      ...product,
      id: String(product._id),
      image: `${IMAGE_BASE}/${product.p_id}`,
      description: stripHtml(product.description),
      sizes: ["S", "M", "L", "XL", "XXL"],
      stock: product.stock ?? 50,
    }));

    res.json(result);
  } catch (err) {
    console.error("Database Fetch Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// Route for: GET /api/products/image/:p_id  (serves the actual image binary)
router.get('/image/:p_id', async (req, res) => {
  try {
    const p_id = Number(req.params.p_id);
    const product = await mongoose.connection.db.collection('products').findOne({ p_id });
    if (!product || !product.image_id) return res.status(404).send('Image not found');

    const imageBuffer = await getImageBuffer(product.image_id);
    if (!imageBuffer) return res.status(404).send('Image not found');

    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(imageBuffer);
  } catch (err) {
    console.error("Image serve error:", err);
    res.status(500).send('Error');
  }
});

// Route for: GET /api/products/recommendations/:p_id
router.get('/recommendations/:p_id', async (req, res) => {
  try {
    const { p_id } = req.params;
    console.log(`--- Proxying rec request for ID: ${p_id}`);

    const pythonRes = await axios.get(`http://127.0.0.1:8000/recommend`, {
      params: { product_id: p_id }
    });

    const recs = pythonRes.data;

    const enriched = await Promise.all(recs.map(async (rec) => {
      try {
        const product = await mongoose.connection.db.collection('products')
          .findOne({ p_id: Number(rec.p_id) });

        if (!product) return { ...rec, id: String(rec.p_id), sizes: ["S", "M", "L", "XL", "XXL"] };

        return {
          ...rec,
          id: String(product._id),
          image: product.image_id ? `${IMAGE_BASE}/${product.p_id}` : undefined,
          description: product.description || "",
          category: product.category || "",
          sizes: ["S", "M", "L", "XL", "XXL"],
        };
      } catch {
        return { ...rec, id: String(rec.p_id), sizes: ["S", "M", "L", "XL", "XXL"] };
      }
    }));

    res.json(enriched);
  } catch (err) {
    console.error("Bridge to Python failed:", err.message);
    res.status(500).json({ error: "Python service offline" });
  }
});

// Route for: GET /api/products/:id  (single product by p_id)
router.get('/:id', async (req, res) => {
  try {
    const p_id = Number(req.params.id);
    const product = await mongoose.connection.db.collection('products').findOne({ p_id });
    if (!product) return res.status(404).json({ error: "Product not found" });

    res.json({
      ...product,
      id: String(product._id),
      image: product.image_id ? `${IMAGE_BASE}/${product.p_id}` : undefined,
      description: stripHtml(product.description),
      sizes: ["S", "M", "L", "XL", "XXL"],
      stock: product.stock ?? 50,
    });
  } catch (err) {
    console.error("Single product fetch error:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
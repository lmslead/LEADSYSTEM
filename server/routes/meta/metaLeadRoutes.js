const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const metaLeadController = require('../../controllers/meta/metaLeadController');

const router = express.Router();

// Allow CORS for Meta webhook verification
router.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Hub-Signature-256']
}));

// Rate limiter for Webhook endpoints (200 requests per 15 mins)
const metaWebhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false
});

// Meta Webhook Verification (GET) & Incoming Events (POST)
router.get('/webhook', metaLeadController.verifyWebhook);
router.post('/webhook', metaWebhookLimiter, metaLeadController.handleWebhookEvent);

// Meta Webhook Processing Logs (GET)
router.get('/logs', metaLeadController.getMetaLogs);

module.exports = router;

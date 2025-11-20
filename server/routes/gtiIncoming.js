const express = require('express');
const rateLimit = require('express-rate-limit');
const { handleIncomingGtiCall } = require('../controllers/gtiController');

const router = express.Router();

const incomingLimiter = rateLimit({
  windowMs: 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/incoming', incomingLimiter, handleIncomingGtiCall);

module.exports = router;

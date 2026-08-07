const metaLeadService = require('../services/metaLeadService');
const MetaLeadPayload = require('../models/MetaLeadPayload');

/**
 * GET /api/meta/webhook
 * Meta Webhook verification endpoint (Verification Challenge).
 */
const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env.META_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('[MetaWebhookController] Verification challenge successful.');
    return res.status(200).send(challenge);
  }

  console.warn('[MetaWebhookController] Verification failed. Token mismatch.');
  return res.status(403).json({
    success: false,
    message: 'Verification failed. Invalid verify token.'
  });
};

/**
 * POST /api/meta/webhook
 * Handles incoming leadgen notification events from Meta.
 */
const handleWebhookEvent = async (req, res) => {
  try {
    // 1. Verify signature if configured
    if (!metaLeadService.verifyMetaSignature(req)) {
      console.warn('[MetaWebhookController] Signature verification failed.');
      return res.status(401).json({ success: false, message: 'Invalid signature.' });
    }

    const { object, entry } = req.body;

    // Must return HTTP 200 OK to Meta immediately
    res.status(200).send('EVENT_RECEIVED');

    // 2. Process page events asynchronously
    if (object === 'page' && Array.isArray(entry)) {
      for (const item of entry) {
        if (Array.isArray(item.changes)) {
          for (const change of item.changes) {
            if (change.field === 'leadgen' && change.value) {
              // Asynchronous background processing
              metaLeadService.processMetaLead(change.value, req.io).catch((err) => {
                console.error('[MetaWebhookController] Async lead processing error:', err.message);
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[MetaWebhookController] Error handling webhook POST:', error);
    // Even in error, if headers haven't been sent, return 200 to prevent Meta retry loop
    if (!res.headersSent) {
      res.status(200).send('EVENT_RECEIVED');
    }
  }
};

/**
 * GET /api/meta/logs
 * Retrieve recent Meta webhook payload logs (for admin review).
 */
const getMetaLogs = async (req, res) => {
  try {
    const logs = await MetaLeadPayload.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('processedLead', 'leadId name email phone category createdAt')
      .lean();

    return res.status(200).json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch Meta webhook logs',
      error: error.message
    });
  }
};

module.exports = {
  verifyWebhook,
  handleWebhookEvent,
  getMetaLogs
};

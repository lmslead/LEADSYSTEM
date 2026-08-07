const mongoose = require('mongoose');

const metaLeadPayloadSchema = new mongoose.Schema({
  leadgenId: {
    type: String,
    required: true,
    index: true
  },
  pageId: {
    type: String,
    index: true
  },
  formId: {
    type: String,
    index: true
  },
  adId: {
    type: String
  },
  adgroupId: {
    type: String
  },
  rawWebhookPayload: {
    type: mongoose.Schema.Types.Mixed
  },
  metaLeadDetails: {
    type: mongoose.Schema.Types.Mixed
  },
  processedLead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead'
  },
  status: {
    type: String,
    enum: ['received', 'processed', 'duplicate', 'failed'],
    default: 'received',
    index: true
  },
  errorMessage: {
    type: String
  }
}, {
  timestamps: true
});

metaLeadPayloadSchema.index({ createdAt: -1 });

module.exports = mongoose.model('MetaLeadPayload', metaLeadPayloadSchema);

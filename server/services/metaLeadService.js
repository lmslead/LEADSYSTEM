const crypto = require('crypto');
const https = require('https');
const Lead = require('../models/Lead');
const MetaLeadPayload = require('../models/MetaLeadPayload');
const Organization = require('../models/Organization');
const User = require('../models/User');

/**
 * Verify X-Hub-Signature-256 header sent by Meta Webhooks.
 */
const verifyMetaSignature = (req) => {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return true; // If secret not set, skip verification

  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;

  const elements = signature.split('=');
  const signatureHash = elements[1];
  const rawBody = req.rawBody || JSON.stringify(req.body);

  const expectedHash = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signatureHash), Buffer.from(expectedHash));
};

/**
 * Fetch lead details from Meta Graph API using leadgen_id.
 */
const fetchMetaLeadDetails = (leadgenId, pageToken) => {
  const token = pageToken || process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) {
    throw new Error('META_PAGE_ACCESS_TOKEN is missing in environment settings');
  }

  const apiVersion = process.env.META_GRAPH_API_VERSION || 'v19.0';
  const url = `https://graph.facebook.com/${apiVersion}/${leadgenId}?access_token=${token}`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            return reject(new Error(parsed.error.message || 'Meta Graph API error'));
          }
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', (err) => reject(err));
  });
};

/**
 * Maps Meta field_data array to internal Lead schema fields.
 */
const parseMetaFieldData = (fieldData = []) => {
  const mapped = {};
  let firstName = '';
  let lastName = '';

  fieldData.forEach((field) => {
    const key = (field.name || '').toLowerCase().trim();
    const value = Array.isArray(field.values) && field.values.length > 0 ? field.values[0] : '';

    if (!value) return;

    if (key === 'full_name' || key === 'name') {
      mapped.name = value;
    } else if (key === 'first_name') {
      firstName = value;
    } else if (key === 'last_name') {
      lastName = value;
    } else if (key === 'email') {
      mapped.email = value.toLowerCase().trim();
    } else if (key === 'phone_number' || key === 'phone') {
      mapped.phone = value;
    } else if (key.includes('debt') || key.includes('amount')) {
      const num = parseFloat(String(value).replace(/[^0-9.]/g, ''));
      if (!isNaN(num)) mapped.totalDebtAmount = num;
    } else if (key === 'state') {
      mapped.state = value;
    } else if (key === 'city') {
      mapped.city = value;
    } else if (key === 'zip_code' || key === 'post_code' || key === 'zip') {
      mapped.zipcode = value;
    } else if (key === 'street_address' || key === 'address') {
      mapped.address = value;
    } else if (key === 'notes' || key === 'comments') {
      mapped.notes = value;
    }
  });

  if (!mapped.name && (firstName || lastName)) {
    mapped.name = `${firstName} ${lastName}`.trim();
  }

  return mapped;
};

/**
 * Resolves default Organization ObjectId for incoming Meta leads.
 */
const resolveMetaOrganization = async () => {
  if (process.env.META_DEFAULT_ORG_ID) {
    return process.env.META_DEFAULT_ORG_ID;
  }
  const org = await Organization.findOne({ isActive: true }).select('_id').lean();
  if (!org) {
    throw new Error('No active organization found to associate Meta lead');
  }
  return org._id;
};

/**
 * Resolves default Creator User ObjectId for incoming Meta leads.
 */
const resolveMetaCreatorUser = async () => {
  if (process.env.META_DEFAULT_USER_ID) {
    return process.env.META_DEFAULT_USER_ID;
  }
  const user = await User.findOne({ role: 'superadmin', isActive: true }).select('_id').lean();
  if (!user) {
    throw new Error('No active superadmin user found for lead creation');
  }
  return user._id;
};

/**
 * Core Service Handler for processing Meta leadgen webhook events.
 */
const processMetaLead = async (value, io) => {
  const { leadgen_id, page_id, form_id, ad_id, adgroup_id } = value;

  if (!leadgen_id) {
    throw new Error('Missing leadgen_id in Meta webhook event payload');
  }

  // Idempotency check: check if leadgen_id was already processed
  const existingPayload = await MetaLeadPayload.findOne({ leadgenId: leadgen_id });
  if (existingPayload && existingPayload.status === 'processed') {
    console.log(`[MetaLeadService] Leadgen ID ${leadgen_id} already processed. Skipping.`);
    return existingPayload;
  }

  // Create or update log entry
  const payloadDoc = existingPayload || new MetaLeadPayload({
    leadgenId: leadgen_id,
    pageId: page_id,
    formId: form_id,
    adId: ad_id,
    adgroupId: adgroup_id,
    rawWebhookPayload: value,
    status: 'received'
  });

  try {
    // 1. Fetch full details from Meta Graph API
    const metaDetails = await fetchMetaLeadDetails(leadgen_id);
    payloadDoc.metaLeadDetails = metaDetails;

    // 2. Parse lead details
    const parsedFields = parseMetaFieldData(metaDetails.field_data || []);

    if (!parsedFields.name) {
      parsedFields.name = `Meta Lead ${leadgen_id}`;
    }

    // 3. Resolve Organization and System Creator User
    const orgId = await resolveMetaOrganization();
    const creatorUserId = await resolveMetaCreatorUser();

    // 4. Construct Lead document payload
    const leadData = {
      ...parsedFields,
      organization: orgId,
      createdBy: creatorUserId,
      qualificationStatus: 'pending',
      notes: parsedFields.notes || `Lead captured from Meta Lead Form (Form ID: ${form_id || 'N/A'}, Ad ID: ${ad_id || 'N/A'})`
    };

    // 5. Create Lead in MongoDB (triggers pre-save hooks for ID generation, category, completion %)
    const newLead = await Lead.create(leadData);

    // 6. Update Payload status
    payloadDoc.status = 'processed';
    payloadDoc.processedLead = newLead._id;
    await payloadDoc.save();

    // 7. Emit Socket.IO real-time notification to active dashboards
    if (io) {
      io.emit('newLead', {
        _id: newLead._id,
        leadId: newLead.leadId,
        name: newLead.name,
        email: newLead.email,
        phone: newLead.phone,
        category: newLead.category,
        completionPercentage: newLead.completionPercentage,
        source: 'Meta Lead Ads',
        createdAt: newLead.createdAt
      });
      io.emit('leadAdded', { leadId: newLead.leadId, source: 'meta' });
    }

    console.log(`[MetaLeadService] Successfully processed Meta Lead ${newLead.leadId} (Leadgen ID: ${leadgen_id})`);
    return payloadDoc;

  } catch (error) {
    console.error(`[MetaLeadService] Failed to process Leadgen ID ${leadgen_id}:`, error.message);
    payloadDoc.status = 'failed';
    payloadDoc.errorMessage = error.message;
    await payloadDoc.save();
    throw error;
  }
};

module.exports = {
  verifyMetaSignature,
  fetchMetaLeadDetails,
  parseMetaFieldData,
  processMetaLead
};

const Lead = require('../models/Lead');

const normalizePhoneNumber = (value = '') => {
  if (!value) return '';
  return value.toString().replace(/\D/g, '');
};

const buildPhoneVariants = (rawNumber = '') => {
  const variants = new Set();
  const trimmed = (rawNumber || '').trim();
  if (trimmed) {
    variants.add(trimmed);
  }

  const digits = normalizePhoneNumber(trimmed);
  if (digits) {
    variants.add(digits);
    if (digits.length === 10) {
      variants.add(`+1${digits}`);
      variants.add(`1${digits}`);
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      variants.add(`+${digits}`);
    }
  }

  return Array.from(variants);
};

const handleIncomingGtiCall = async (req, res) => {
  try {
    const { primary_number: primaryNumber } = req.body || {};

    if (!primaryNumber) {
      return res.status(400).json({ message: 'primary_number is required' });
    }

    const phoneVariants = buildPhoneVariants(primaryNumber);
    if (phoneVariants.length === 0) {
      return res.status(400).json({ message: 'primary_number is invalid' });
    }

    const duplicateLead = await Lead.findOne({
      $or: [
        { phone: { $in: phoneVariants } },
        { alternatePhone: { $in: phoneVariants } }
      ]
    })
      .select('_id leadId phone alternatePhone')
      .lean();

    if (duplicateLead) {
      return res.status(200).json({ status: 'duplicate' });
    }

    return res.status(200).json({});
  } catch (error) {
    console.error('GTI incoming webhook error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  handleIncomingGtiCall,
};

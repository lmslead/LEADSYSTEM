/**
 * Affiliate Admin Dashboard routes
 *
 * All routes require JWT auth + role affiliate_admin OR superadmin.
 * Data is scoped exclusively to Closers_OB / CloserOB campaign leads.
 * No cross-org data or internal LMS data is exposed.
 */
const express = require('express');
const { query } = require('express-validator');
const Lead = require('../models/Lead');
const { protect, authorize } = require('../middleware/auth');
const handleValidationErrors = require('../middleware/validation');
const { formatEasternTime } = require('../utils/timeFilters');

const router = express.Router();

// Campaign values that belong to this affiliate's scope.
// Case-insensitive match so 'closers_ob' / 'CLOSERS_OB' both work.
const AFFILIATE_CAMPAIGNS = ['Closers_OB', 'CloserOB'];

/**
 * Build a MongoDB $in filter for the affiliate campaign names (case-insensitive).
 * We store vicidialCampaignName as trimmed raw strings, so we build regex matchers.
 */
const buildCampaignFilter = () => ({
  vicidialCampaignName: {
    $in: AFFILIATE_CAMPAIGNS.map(
      (c) => new RegExp(`^${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    ),
  },
});

/**
 * Build a date filter on createdAt from YYYY-MM-DD query params.
 */
const buildDateFilter = (startDate, endDate) => {
  const filter = {};
  if (startDate) filter.$gte = new Date(startDate + 'T00:00:00Z');
  if (endDate)   filter.$lte = new Date(endDate   + 'T23:59:59.999Z');
  return Object.keys(filter).length ? { createdAt: filter } : {};
};

// ─── Shared populate config ───────────────────────────────────────────────────
const POPULATE_OPTS = [
  { path: 'createdBy', select: 'name' },    // Agent 1
  { path: 'updatedBy', select: 'name' },    // Agent 2 — most recent updater
  { path: 'assignedTo', select: 'name' },   // Agent 2 assigned
];

// ─── Projection — only the 8 columns the affiliate dashboard shows ────────────
const PROJECTION = {
  createdAt: 1,
  totalDebtAmount: 1,
  phone: 1,
  name: 1,
  draftDate: 1,
  creditScore: 1,
  leadProgressStatus: 1,
  createdBy: 1,
  updatedBy: 1,
  assignedTo: 1,
  vicidialCampaignName: 1,
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/affiliate/leads
// Returns paginated affiliate campaign leads with optional filters.
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/leads',
  protect,
  authorize('affiliate_admin', 'superadmin'),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('limit must be 1-500'),
    query('startDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('startDate must be YYYY-MM-DD'),
    query('endDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('endDate must be YYYY-MM-DD'),
    query('saleOnly').optional().isIn(['true', 'false']).withMessage('saleOnly must be true or false'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const page  = Math.max(1, parseInt(req.query.page)  || 1);
      const limit = Math.min(500, parseInt(req.query.limit) || 100);
      const skip  = (page - 1) * limit;

      const filter = {
        ...buildCampaignFilter(),
        ...buildDateFilter(req.query.startDate, req.query.endDate),
      };

      // Sale filter
      if (req.query.saleOnly === 'true') {
        filter.leadProgressStatus = { $in: ['SALE', 'Sale Long Play', 'Immediate Enrollment'] };
      }

      const [leads, total] = await Promise.all([
        Lead.find(filter, PROJECTION)
          .populate(POPULATE_OPTS)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Lead.countDocuments(filter),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          leads,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (err) {
      console.error('[Affiliate] leads fetch error:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/affiliate/leads/export
// Returns a CSV download of all matching leads (no pagination).
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/leads/export',
  protect,
  authorize('affiliate_admin', 'superadmin'),
  [
    query('startDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('startDate must be YYYY-MM-DD'),
    query('endDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('endDate must be YYYY-MM-DD'),
    query('saleOnly').optional().isIn(['true', 'false']).withMessage('saleOnly must be true or false'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const filter = {
        ...buildCampaignFilter(),
        ...buildDateFilter(req.query.startDate, req.query.endDate),
      };

      if (req.query.saleOnly === 'true') {
        filter.leadProgressStatus = { $in: ['SALE', 'Sale Long Play', 'Immediate Enrollment'] };
      }

      const leads = await Lead.find(filter, PROJECTION)
        .populate(POPULATE_OPTS)
        .sort({ createdAt: -1 })
        .lean();

      // ── CSV generation ─────────────────────────────────────────────────────
      const esc = (val) => {
        if (val === null || val === undefined) return '';
        const s = String(val);
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"` : s;
      };

      const fmt = (date) => (date ? formatEasternTime(new Date(date)) : '');

      const header = [
        'Lead Created At',
        'Customer Name',
        'Primary Phone',
        'Total Debt Amount',
        'First Draft Date',
        'Credit Score',
        'Lead Progress Status',
        'Agent 1 (Added By)',
        'Agent 2 (Updated By)',
        'Campaign',
      ].join(',');

      const rows = leads.map((l) =>
        [
          esc(fmt(l.createdAt)),
          esc(l.name || ''),
          esc(l.phone || ''),
          esc(l.totalDebtAmount != null ? l.totalDebtAmount : ''),
          esc(l.draftDate ? fmt(l.draftDate) : ''),
          esc(l.creditScore != null ? l.creditScore : ''),
          esc(l.leadProgressStatus || ''),
          esc(l.createdBy?.name || ''),
          esc(l.updatedBy?.name || l.assignedTo?.name || ''),
          esc(l.vicidialCampaignName || ''),
        ].join(',')
      );

      const csv = [header, ...rows].join('\n');
      const ts  = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="affiliate_leads_${ts}.csv"`);
      res.setHeader('Cache-Control', 'no-cache');
      return res.status(200).send(csv);
    } catch (err) {
      console.error('[Affiliate] export error:', err);
      return res.status(500).json({ success: false, message: 'Export failed' });
    }
  }
);

module.exports = router;

 // COMPLETE EXPORT ROUTE WITH ALL MONGODB FIELDS
// File: server/routes/leads.js (Export section)

// @desc    Export leads to CSV with comprehensive filtering and ALL MongoDB fields
// @route   GET /api/leads/export
// @access  Private (SuperAdmin, Main Organization Admin only)
router.get('/export', protect, async (req, res) => {
  try {
    console.log(`Export request from ${req.user.role} user: ${req.user._id}`);

    // Restrict access to superadmin and main organization admin only
    if (req.user.role !== 'superadmin' && 
        (req.user.role !== 'admin' || req.user.organizationName !== 'REDDINGTON GLOBAL CONSULTANCY')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only superadmin and main organization admin can export leads.'
      });
    }

    // Build filter object with comprehensive filtering
    let filter = {};

    // Organization filtering for main admin
    if (req.user.role === 'admin' && req.user.organizationName === 'REDDINGTON GLOBAL CONSULTANCY') {
      console.log('REDDINGTON GLOBAL CONSULTANCY Admin filter applied: Can see all leads');
    } else if (req.user.role === 'admin') {
      filter.organization = req.user.organization;
      console.log('Admin filter applied: organization-restricted');
    }

    // Apply search filters from query parameters
    const { 
      search, 
      status, 
      category, 
      qualification, 
      duplicates, 
      organization, 
      assignedTo, 
      startDate, 
      endDate 
    } = req.query;

    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { phone: new RegExp(search, 'i') },
        { leadId: new RegExp(search, 'i') }
      ];
    }

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (category && category !== 'all') {
      filter.category = category;
    }

    if (qualification && qualification !== 'all') {
      filter.qualificationStatus = qualification;
    }

    if (duplicates && duplicates !== 'all') {
      if (duplicates === 'duplicates') {
        filter.isDuplicate = true;
      } else if (duplicates === 'non-duplicates') {
        filter.isDuplicate = { $ne: true };
      }
    }

    if (organization && organization !== 'all') {
      filter.organization = organization;
    }

    if (assignedTo && assignedTo !== 'all') {
      if (assignedTo === 'unassigned') {
        filter.assignedTo = { $exists: false };
      } else {
        filter.assignedTo = assignedTo;
      }
    }

    // Date filtering
    if (startDate && endDate) {
      const start = toEasternTime(new Date(startDate));
      const end = toEasternTime(new Date(endDate));
      end.setHours(23, 59, 59, 999);
      
      filter.createdAt = {
        $gte: start,
        $lte: end
      };
    } else if (startDate) {
      const start = toEasternTime(new Date(startDate));
      filter.createdAt = { $gte: start };
    } else if (endDate) {
      const end = toEasternTime(new Date(endDate));
      end.setHours(23, 59, 59, 999);
      filter.createdAt = { $lte: end };
    }

    console.log('Export filter:', filter);

    // Get all matching leads (no pagination for export) with ALL populated fields
    const leads = await Lead.find(filter)
      .populate('organization', 'name')
      .populate('assignedTo', 'name')
      .populate('assignedBy', 'name')
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name')
      .populate('duplicateDetectedBy', 'name')
      .populate('duplicateOf', 'leadId name')
      .sort({ createdAt: -1 });

    console.log(`Export found ${leads.length} leads`);

    // Convert to CSV format - ALL FIELDS FROM MONGODB SCHEMA (58 TOTAL FIELDS)
    const csvHeader = [
      'Lead ID',
      'Name',
      'Email', 
      'Phone',
      'Alternate Phone',
      'Debt Category',
      'Debt Types',
      'Total Debt Amount',
      'Number of Creditors',
      'Monthly Debt Payment',
      'Credit Score',
      'Credit Score Range',
      'Budget',
      'Source',
      'Company',
      'Job Title',
      'Location',
      'Requirements',
      'Notes',
      'Address',
      'City',
      'State',
      'Zipcode',
      'Category',
      'Completion Percentage',
      'Status',
      'Lead Status',
      'Contact Status',
      'Qualification Outcome',
      'Call Disposition',
      'Engagement Outcome',
      'Disqualification',
      'Lead Progress Status',
      'Qualification Status',
      'Agent 2 Last Action',
      'Last Updated By',
      'Last Updated At',
      'Follow Up Date',
      'Follow Up Time',
      'Follow Up Notes',
      'Created By',
      'Updated By',
      'Organization',
      'Assigned To',
      'Assigned By',
      'Assigned At',
      'Assignment Notes',
      'Priority',
      'Converted At',
      'Conversion Value',
      'Admin Processed',
      'Admin Processed At',
      'Is Duplicate',
      'Duplicate Of',
      'Duplicate Reason',
      'Duplicate Detected At',
      'Duplicate Detected By',
      'Created Date (Eastern)',
      'Updated Date (Eastern)'
    ].join(',');

    // Map ALL MongoDB fields to CSV rows
    const csvRows = leads.map(lead => {
      const formatValue = (value) => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      const formatArray = (arr) => {
        if (!Array.isArray(arr)) return '';
        return `"${arr.join('; ')}"`;
      };
      
      return [
        formatValue(lead.leadId),
        formatValue(lead.name),
        formatValue(lead.email),
        formatValue(lead.phone),
        formatValue(lead.alternatePhone),
        formatValue(lead.debtCategory),
        formatArray(lead.debtTypes),
        formatValue(lead.totalDebtAmount),
        formatValue(lead.numberOfCreditors),
        formatValue(lead.monthlyDebtPayment),
        formatValue(lead.creditScore),
        formatValue(lead.creditScoreRange),
        formatValue(lead.budget),
        formatValue(lead.source),
        formatValue(lead.company),
        formatValue(lead.jobTitle),
        formatValue(lead.location),
        formatValue(lead.requirements),
        formatValue(lead.notes),
        formatValue(lead.address),
        formatValue(lead.city),
        formatValue(lead.state),
        formatValue(lead.zipcode),
        formatValue(lead.category),
        formatValue(lead.completionPercentage),
        formatValue(lead.status),
        formatValue(lead.leadStatus),
        formatValue(lead.contactStatus),
        formatValue(lead.qualificationOutcome),
        formatValue(lead.callDisposition),
        formatValue(lead.engagementOutcome),
        formatValue(lead.disqualification),
        formatValue(lead.leadProgressStatus),
        formatValue(lead.qualificationStatus),
        formatValue(lead.agent2LastAction),
        formatValue(lead.lastUpdatedBy),
        formatValue(lead.lastUpdatedAt ? formatEasternTime(lead.lastUpdatedAt) : ''),
        formatValue(lead.followUpDate ? formatEasternTime(lead.followUpDate) : ''),
        formatValue(lead.followUpTime),
        formatValue(lead.followUpNotes),
        formatValue(lead.createdBy?.name || ''),
        formatValue(lead.updatedBy?.name || ''),
        formatValue(lead.organization?.name || ''),
        formatValue(lead.assignedTo?.name || ''),
        formatValue(lead.assignedBy?.name || ''),
        formatValue(lead.assignedAt ? formatEasternTime(lead.assignedAt) : ''),
        formatValue(lead.assignmentNotes),
        formatValue(lead.priority),
        formatValue(lead.convertedAt ? formatEasternTime(lead.convertedAt) : ''),
        formatValue(lead.conversionValue),
        formatValue(lead.adminProcessed ? 'Yes' : 'No'),
        formatValue(lead.adminProcessedAt ? formatEasternTime(lead.adminProcessedAt) : ''),
        formatValue(lead.isDuplicate ? 'Yes' : 'No'),
        formatValue(lead.duplicateOf),
        formatValue(lead.duplicateReason),
        formatValue(lead.duplicateDetectedAt ? formatEasternTime(lead.duplicateDetectedAt) : ''),
        formatValue(lead.duplicateDetectedBy?.name || ''),
        formatValue(formatEasternTime(lead.createdAt)),
        formatValue(formatEasternTime(lead.updatedAt))
      ].join(',');
    });

    const csvContent = [csvHeader, ...csvRows].join('\n');

    // Set headers for CSV download
    const timestamp = formatEasternTime(getEasternNow()).replace(/[^0-9]/g, '');
    const filename = `leads_export_comprehensive_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Pragma', 'no-cache');

    res.status(200).send(csvContent);

  } catch (error) {
    console.error('Export leads error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting leads',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
});

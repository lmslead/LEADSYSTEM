# Qualification Status Backward Compatibility

## Overview
This document describes the backward compatibility implementation for the `qualificationStatus` field in the lead management system.

## History
1. **Initial**: Used `"unqualified"`
2. **Updated**: Changed to `"disqualified"`
3. **Final**: Now using `"not-qualified"`

## Implementation

### Database Model (server/models/Lead.js)
The Lead schema now accepts all three variants:
```javascript
qualificationStatus: {
  type: String,
  enum: ['qualified', 'not-qualified', 'disqualified', 'unqualified', 'pending'],
  default: 'pending'
}
```

### Backend Filtering (server/routes/leads.js)
When filtering by `qualificationStatus === 'not-qualified'`, the backend automatically includes all three variants:
```javascript
if (req.query.qualificationStatus === 'not-qualified') {
  filter.qualificationStatus = { 
    $in: ['not-qualified', 'disqualified', 'unqualified'] 
  };
}
```

This applies to:
- ✅ GET /api/leads (main leads endpoint)
- ✅ GET /api/leads/export (CSV export)
- ✅ Dashboard statistics calculation

### Frontend Display
All three variants display as **"Not - Qualified"** with the same red badge styling:

#### AdminDashboard.js
- Updated `getQualificationBadge()` function to map all three variants
- Filter button labeled "Not - Qualified" searches all three variants

#### Agent2Dashboard.js
- Updated lead list display
- Updated modal detail view

## Behavior

### For New Leads
- All new leads created will use `"not-qualified"` status
- Forms and dropdowns use `"not-qualified"` option

### For Existing Leads
- Old leads with `"disqualified"` or `"unqualified"` status remain unchanged in the database
- When displayed, they show as "Not - Qualified" (user-friendly)
- When filtered by "Not - Qualified", all three variants are included in results
- When exported to CSV, the original database value is preserved

### For Statistics
The dashboard statistics correctly count all three variants:
```javascript
notQualifiedLeads: {
  $sum: { 
    $cond: [
      { $in: ['$qualificationStatus', ['not-qualified', 'disqualified', 'unqualified']] }, 
      1, 
      0
    ] 
  }
}
```

## Benefits
1. ✅ **No Data Migration Required** - Old data remains intact
2. ✅ **Consistent UI** - All variants display uniformly
3. ✅ **Accurate Filtering** - Search/filter includes all variants
4. ✅ **Correct Statistics** - Counts are accurate across all variants
5. ✅ **Future-Proof** - New leads use standardized value

## Testing Checklist
- [ ] Filter by "Not - Qualified" returns leads with all three statuses
- [ ] Export CSV preserves original database values
- [ ] Dashboard statistics count all three variants correctly
- [ ] New leads created use "not-qualified" status
- [ ] UI displays all variants as "Not - Qualified"
- [ ] Search functionality works across all variants

## Files Modified
1. `server/models/Lead.js` - Added enum values for backward compatibility
2. `server/routes/leads.js` - Filter logic includes all variants (already implemented)
3. `client/src/pages/AdminDashboard.js` - Updated badge display function
4. `client/src/pages/Agent2Dashboard.js` - Updated UI rendering in two places

## Migration Notes
If you ever want to normalize all old values to "not-qualified", run this MongoDB command:
```javascript
db.leads.updateMany(
  { qualificationStatus: { $in: ['disqualified', 'unqualified'] } },
  { $set: { qualificationStatus: 'not-qualified' } }
)
```

**Note:** This is optional and not required for the system to function correctly.

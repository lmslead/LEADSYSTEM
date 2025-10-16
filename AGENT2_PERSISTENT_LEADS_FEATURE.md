# Agent 2 Persistent Leads Feature Implementation

## Overview
This document describes the implementation of persistent lead visibility for Agent 2 (Closer) role, allowing them to view and manage leads with specific statuses that persist across days.

## Feature Requirements
Agent 2 users can now view:
1. **Pending Qualification Status Leads**: Leads with `qualificationStatus = 'pending'` assigned to them
2. **Callback Needed Leads**: Leads with `leadProgressStatus = 'Callback Needed'` assigned to them

These leads will **persist on their dashboard until the status is changed**, regardless of the date they were created.

## Implementation Details

### Backend Changes (server/routes/leads.js)

#### 1. Main GET Route (Line ~995-1009)
Updated the Agent2 filter logic to include persistent leads:

```javascript
} else if (req.user.role === 'agent2') {
  // Agent2 can see:
  // 1. Leads assigned to them
  // 2. Duplicate leads (for review)
  // 3. Leads with qualificationStatus 'pending' (persistent across days)
  // 4. Leads with leadProgressStatus 'Callback Needed' (persistent across days)
  filter.$or = [
    { 
      assignedTo: req.user._id,
      adminProcessed: { $ne: true }
    },
    { 
      isDuplicate: true,
      adminProcessed: { $ne: true }
    },
    {
      assignedTo: req.user._id,
      qualificationStatus: 'pending',
      adminProcessed: { $ne: true }
    },
    {
      assignedTo: req.user._id,
      leadProgressStatus: 'Callback Needed',
      adminProcessed: { $ne: true }
    }
  ];
  console.log('Agent2 filter applied:', filter);
```

#### 2. Export Route (Line ~552-566)
Applied the same filter logic to the CSV export route to ensure consistency:

```javascript
} else if (req.user.role === 'agent2') {
  // Agent2 can see:
  // 1. Leads assigned to them
  // 2. Duplicate leads (for review)
  // 3. Leads with qualificationStatus 'pending' (persistent across days)
  // 4. Leads with leadProgressStatus 'Callback Needed' (persistent across days)
  filter.$or = [
    { 
      assignedTo: req.user._id,
      adminProcessed: { $ne: true }
    },
    { 
      isDuplicate: true,
      adminProcessed: { $ne: true }
    },
    {
      assignedTo: req.user._id,
      qualificationStatus: 'pending',
      adminProcessed: { $ne: true }
    },
    {
      assignedTo: req.user._id,
      leadProgressStatus: 'Callback Needed',
      adminProcessed: { $ne: true }
    }
  ];
  console.log('Agent2 export filter applied:', filter);
```

### Frontend - No Changes Required

The Agent2Dashboard.js already:
- ✅ Does NOT send date filter parameters to the server (see line 237 comment)
- ✅ Displays Qualification Status with proper badges (Pending = yellow "⏳ Pending")
- ✅ Shows Lead Progress Status in the View Details modal
- ✅ Includes "Callback Needed" in the agent2LeadProgressOptions array
- ✅ Has dropdown to update both qualificationStatus and leadProgressStatus

## How It Works

### 1. Date Filtering Behavior
- **Agent1**: Can set date filters (today, week, month, custom)
- **Agent2**: NO date filters applied by default
- **Admin/SuperAdmin**: Can set date filters

Since Agent2 does NOT send `dateFilterType`, `startDate`, or `endDate` parameters, the server returns ALL leads matching the filter criteria regardless of creation date.

### 2. Persistence Logic
A lead will remain visible on Agent2's dashboard as long as:
- It is assigned to the Agent2 user (`assignedTo = req.user._id`)
- AND it has `qualificationStatus = 'pending'` OR `leadProgressStatus = 'Callback Needed'`
- AND it has NOT been processed by admin (`adminProcessed != true`)

### 3. Lead Removal
Leads will be removed from Agent2's dashboard when:
- The `qualificationStatus` is changed from 'pending' to 'qualified' or 'not-qualified'
- OR the `leadProgressStatus` is changed from 'Callback Needed' to any other status
- OR the lead is marked as `adminProcessed = true`
- OR the lead is reassigned to a different Agent2

## UI Elements

### Table Display
- **Qualification Status Column**: Shows badge with:
  - 🟢 "✅ Qualified" (green)
  - 🔴 "❌ Not - Qualified" (red)
  - 🟡 "⏳ Pending" (yellow) ← Persistent leads

### View Details Modal
- **Current Lead Progress Status Section**: 
  - Prominently displays the `leadProgressStatus` including "Callback Needed"
  - Shows blue badge with status information

### Update Status Modal
- **Qualification Status Dropdown**:
  - Options: qualified, not-qualified, pending
  
- **Lead Progress Status Dropdown**:
  - Includes "Callback Needed" option
  - Also includes: Appointment Scheduled, Immediate Enrollment, Info Provided – Awaiting Decision, Nurture – Not Ready, etc.

## Testing Checklist

- [ ] Agent2 can see leads with `qualificationStatus = 'pending'` assigned to them
- [ ] Agent2 can see leads with `leadProgressStatus = 'Callback Needed'` assigned to them
- [ ] These leads persist across multiple days (not just today)
- [ ] When qualification status changes from 'pending', the lead is removed from dashboard
- [ ] When lead progress status changes from 'Callback Needed', the lead is removed from dashboard
- [ ] Export functionality includes persistent leads
- [ ] Leads from other days show correct created date
- [ ] Agent2 can update both qualificationStatus and leadProgressStatus
- [ ] Real-time updates work correctly with Socket.IO

## Database Schema Reference

### Lead Model Fields
```javascript
qualificationStatus: {
  type: String,
  enum: ['qualified', 'not-qualified', 'pending'],
  required: true
}

leadProgressStatus: {
  type: String,
  // Can be any of agent2LeadProgressOptions including 'Callback Needed'
}

assignedTo: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User'
}

adminProcessed: {
  type: Boolean,
  default: false
}
```

## Benefits

1. **Improved Follow-up**: Agent2 can easily track leads requiring callbacks
2. **Better Workflow**: Pending leads remain visible for continued processing
3. **No Lost Leads**: Leads don't disappear after the day they were created
4. **Flexibility**: Agent2 can work on leads over multiple days as needed
5. **Clear Visibility**: Badge system makes pending/callback leads immediately identifiable

## Related Files Modified
- `server/routes/leads.js` - Main GET route filter (line ~995-1009)
- `server/routes/leads.js` - Export route filter (line ~552-566)

## Related Documentation
- `DATABASE_MIGRATION_GUIDE.md` - Database schema information
- `TERMINOLOGY_CHANGE_SUMMARY.md` - Recent terminology updates
- `README.md` - Project overview

---
**Implementation Date**: October 14, 2025
**Developer Notes**: All changes are backward compatible and work with existing database records.

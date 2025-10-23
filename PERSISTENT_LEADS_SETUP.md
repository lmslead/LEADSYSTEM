# Persistent Leads Feature - Database Sync Instructions

## Overview
This guide will help you sync your database with the new persistent leads feature that allows Agent2 users to see leads that need attention until they update the status.

## Quick Setup (Recommended)

### Option 1: Run the Complete Setup Script
```bash
cd server
node setup-persistent-leads.js
```

This will automatically:
1. Verify your current database state
2. Run the migration to add missing fields
3. Show you a summary of what was updated

## Manual Setup (Step by Step)

### Step 1: Verify Current Database State
First, check what needs to be updated:
```bash
cd server
node verify-persistent-leads-database.js
```

This will show you:
- How many leads currently exist
- Which leads are missing the new status fields
- How many Agent2 users will benefit from this feature
- Estimated impact of the migration

### Step 2: Run the Database Migration
If the verification shows leads that need updating:
```bash
cd server
node migrate-persistent-leads-feature.js
```

This will:
- Set `qualificationStatus: 'pending'` for leads without this field
- Set `leadProgressStatus: 'Callback Needed'` for assigned leads
- Add tracking fields for better audit trail
- Show a summary of changes made

### Step 3: Test the API (Optional)
To verify the API endpoints are working:
```bash
cd server
node test-persistent-leads-api.js
```

## What These Scripts Do

### 1. Verification Script (`verify-persistent-leads-database.js`)
- ✅ Checks current database state
- ✅ Shows what will be changed
- ✅ Lists Agent2 users who will use the feature
- ✅ Estimates persistent leads after migration

### 2. Migration Script (`migrate-persistent-leads-feature.js`)
- ✅ Updates existing leads with default status values
- ✅ Sets assigned leads to persistent status
- ✅ Adds audit trail fields
- ✅ Preserves all existing data

### 3. Setup Script (`setup-persistent-leads.js`)
- ✅ Runs verification + migration in sequence
- ✅ Provides clear success/failure feedback
- ✅ Shows next steps after completion

## Database Fields Added/Updated

The migration ensures these fields exist on all leads:

```javascript
// Qualification status for Agent2 workflow
qualificationStatus: 'pending' | 'qualified' | 'not-qualified'

// Progress status for Agent2 workflow  
leadProgressStatus: 'Callback Needed' | 'SALE' | 'Not Interested' | ...

// Audit trail fields
lastUpdatedBy: String    // Name of user who last updated
lastUpdatedAt: Date      // When it was last updated
```

## How Persistence Works

After migration:

### For Assigned Leads:
- `qualificationStatus` → `'pending'` (appears in "Pending Qualification" tab)
- `leadProgressStatus` → `'Callback Needed'` (appears in "Callback Needed" tab)

### For New Assignments:
- Agent1 assigns lead → automatically sets both statuses
- Lead appears in both Agent2 tabs until status is updated

### For Status Updates:
- Agent2 changes qualification → lead may disappear from "Pending Qualification"
- Agent2 changes progress → lead may disappear from "Callback Needed"

## Testing the Feature

After running the migration:

1. **Restart your server** to load the updated code
2. **Login as Agent1** and assign a lead to Agent2 with closure name
3. **Login as Agent2** and check the dashboard
4. **Verify tabs show**:
   - "Today's Leads" (today's assignments)
   - "Pending Qualification" (persistent until qualified)
   - "Callback Needed" (persistent until status changed)
5. **Test status updates** and verify leads move/disappear correctly

## Troubleshooting

### Common Issues:

**"Cannot connect to MongoDB"**
- Check your `.env` file has correct `MONGODB_URI`
- Ensure MongoDB service is running

**"Permission denied"**
- Make sure your database user has write permissions
- Check if database is read-only

**"No leads found"**
- Verify you have leads in your database
- Check if you're connecting to the correct database

**"Scripts not found"**
- Make sure you're in the `server` directory
- Verify the script files were created properly

### Getting Help:

If you encounter issues:
1. Check the console output for specific error messages
2. Verify your database connection works with other operations
3. Make sure you have backup of your database (recommended)
4. Contact support with the full error message

## Rollback (If Needed)

The migration only adds fields and doesn't delete data. If you need to rollback:

```javascript
// Remove the added fields (optional)
db.leads.updateMany(
  {},
  { 
    $unset: { 
      qualificationStatus: "",
      leadProgressStatus: "",
      lastUpdatedBy: "",
      lastUpdatedAt: ""
    }
  }
)
```

## Success Indicators

✅ **Setup was successful if:**
- Scripts run without errors
- Verification shows expected lead counts
- Agent2 dashboard shows new tabs
- Leads persist across browser refreshes
- Status updates work correctly

🎉 **Your persistent leads feature is now active!**
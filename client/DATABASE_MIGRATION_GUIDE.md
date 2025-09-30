# Database Migration Guide

This guide explains how to migrate your LMS database data between different databases while preserving all data, relationships, and structure.

## 🔄 Migration Process Overview

1. **Export data** from source database
2. **Set up new database** connection
3. **Import data** to target database
4. **Verify migration** success

## 📤 Step 1: Export Data from Source Database

### Run Export Script
```bash
# Navigate to server directory
cd server

# Run export script
node export-database.js
```

### What Gets Exported
- ✅ **Users** (including passwords, roles, organization references)
- ✅ **Organizations** (all organization data and settings)
- ✅ **Leads** (all lead data with user/organization references)
- ✅ **ObjectIds preserved** (maintains relationships)
- ✅ **Timestamps** (createdAt, updatedAt, etc.)

### Export Output
Creates folder: `database-export/export-YYYY-MM-DDTHH-mm-ss-sssZ/`
- `users.json` - All user data with hashed passwords
- `organizations.json` - All organization data
- `leads.json` - All lead data
- `export-summary.json` - Migration metadata
- `import-instructions.txt` - Step-by-step import guide

## 📥 Step 2: Import Data to New Database

### Update Database Connection
1. Update `.env` file with new database connection:
```env
MONGODB_URI=mongodb://your-new-database-connection
```

### Run Import Script
```bash
# Use the export folder name from step 1
node import-database.js export-2025-01-11T10-30-00-000Z

# For existing database (with confirmation)
node import-database.js export-2025-01-11T10-30-00-000Z --force
```

### Import Safety Features
- ⚠️ **Automatic safety check** - Won't import to non-empty database
- 🔄 **Duplicate handling** - Skips existing records
- 📊 **Batch processing** - Efficient large data import
- ✅ **Verification** - Confirms successful migration

## 🎯 Step 3: Verify Migration

### Check Data Counts
```bash
# After import, verify all data transferred
node -e "
const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const Organization = require('./models/Organization');
const Lead = require('./models/Lead');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = await User.countDocuments();
  const orgs = await Organization.countDocuments();
  const leads = await Lead.countDocuments();
  console.log('Users:', users);
  console.log('Organizations:', orgs);
  console.log('Leads:', leads);
  process.exit(0);
})();
"
```

### Test Super Admin Login
```bash
# Verify super admin accounts work
node -e "
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const User = require('./models/User');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const admin = await User.findOne({ email: 'vishal@lms.com' });
  if (admin) {
    const isValid = await bcrypt.compare('@dm!n123', admin.password);
    console.log('Super admin login test:', isValid ? 'PASS' : 'FAIL');
  }
  process.exit(0);
})();
"
```

## 🔧 Common Migration Scenarios

### Scenario 1: Fresh Database Migration
```bash
# 1. Export from old database
node export-database.js

# 2. Update .env to new database
# MONGODB_URI=mongodb://new-database-url

# 3. Import to empty new database
node import-database.js export-YYYY-MM-DDTHH-mm-ss-sssZ
```

### Scenario 2: Database with Existing Data
```bash
# Use --force flag to merge data
node import-database.js export-YYYY-MM-DDTHH-mm-ss-sssZ --force
```

### Scenario 3: Backup and Restore
```bash
# Create backup
node export-database.js

# Later restore from backup
node import-database.js export-YYYY-MM-DDTHH-mm-ss-sssZ
```

## ⚡ Performance Tips

### Large Database Migration
- **Batch processing**: Import handles large datasets automatically
- **Network optimization**: Run migration close to database server
- **Memory management**: Import processes data in chunks

### Speed Optimization
```bash
# For very large databases, you can modify batch sizes in import-database.js
# Default batch size: 100 records per batch
# Increase for faster imports: change batchSize = 500
```

## 🛡️ Data Integrity Guarantees

### Preserved Data
- ✅ **User passwords** - Hashed passwords maintained
- ✅ **ObjectId references** - All relationships preserved
- ✅ **Timestamps** - Original creation/update times
- ✅ **Indexes** - Database indexes maintained
- ✅ **Validation** - All schema validations enforced

### Relationship Integrity
- 👥 **User → Organization** references preserved
- 📋 **Lead → User** assignments maintained
- 🏢 **Lead → Organization** associations kept
- 🔗 **All foreign key** relationships intact

## 🚨 Troubleshooting

### Error: "Export folder not found"
```bash
# Check available exports
ls database-export/
# Use exact folder name
node import-database.js export-YYYY-MM-DDTHH-mm-ss-sssZ
```

### Error: "Target database not empty"
```bash
# Option 1: Use force flag
node import-database.js export-folder-name --force

# Option 2: Clear target database first
# (Be careful - this deletes all data!)
```

### Error: "Duplicate key error"
```bash
# Import script automatically handles duplicates
# Check import log for skipped records
# Use --force flag if needed
```

## 📋 Migration Checklist

### Pre-Migration
- [ ] Source database accessible
- [ ] Target database accessible
- [ ] Sufficient disk space for export
- [ ] .env file updated for target database

### During Migration
- [ ] Export completed successfully
- [ ] Export summary shows expected record counts
- [ ] Target database connection tested
- [ ] Import completed without errors

### Post-Migration
- [ ] Data counts match between source and target
- [ ] Super admin login works
- [ ] Application connects to new database
- [ ] All user logins functional
- [ ] Lead data displays correctly

## 🎉 Success Verification

After successful migration, you should see:
```
🎉 Import completed successfully!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Final Database State:
   👥 Users: XXX
   🏢 Organizations: XXX
   📋 Leads: XXX
   📈 Total Records: XXX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👑 Super Admins Available:
   - Vishal (vishal@lms.com)
   - Jitin (jitin@lms.com)
   - Jyotsana (jyotsana@lms.com)
```

## 🔄 Regular Backup Strategy

### Daily Backups
```bash
# Add to cron job for daily backups
0 2 * * * cd /path/to/server && node export-database.js
```

### Pre-Deployment Backup
```bash
# Always backup before deployments
node export-database.js
```

This migration system ensures 100% data preservation with all relationships, passwords, and configurations intact.

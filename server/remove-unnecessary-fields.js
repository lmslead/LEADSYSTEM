/**
 * Database Cleanup Script
 * Removes unnecessary/deprecated fields from Lead collection
 * 
 * BACKUP YOUR DATABASE BEFORE RUNNING THIS SCRIPT!
 * 
 * Run: node remove-unnecessary-fields.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('./models/Lead');

const MONGODB_URI = process.env.MONGODB_URI || 'your-mongodb-connection-string';

// Fields to remove from all Lead documents
const FIELDS_TO_REMOVE = [
  // Legacy fields (not used anymore)
  'budget',
  'source',
  'company',
  'jobTitle',
  'location',
  'requirements',
  
  // Old Agent2 status fields (replaced by leadProgressStatus)
  'leadStatus',
  'contactStatus',
  'qualificationOutcome',
  'callDisposition',
  'engagementOutcome',
  'disqualification',
  
  // Old status field (replaced by qualificationStatus)
  'status',
  
  // Redundant tracking
  'agent2LastAction',
  
  // Auto-derived field (not needed in DB)
  'priority'
];

async function removeUnnecessaryFields() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get total count before cleanup
    const totalLeads = await Lead.countDocuments();
    console.log(`📊 Total leads in database: ${totalLeads}\n`);

    // Check if any leads have these fields
    console.log('🔍 Checking for unnecessary fields...\n');
    const fieldsFound = {};
    
    for (const field of FIELDS_TO_REMOVE) {
      const query = { [field]: { $exists: true } };
      const count = await Lead.countDocuments(query);
      if (count > 0) {
        fieldsFound[field] = count;
        console.log(`   📌 ${field}: Found in ${count} leads`);
      }
    }

    if (Object.keys(fieldsFound).length === 0) {
      console.log('\n✨ No unnecessary fields found. Database is clean!');
      await mongoose.connection.close();
      return;
    }

    console.log(`\n⚠️  Found ${Object.keys(fieldsFound).length} unnecessary field(s) in database`);
    console.log('\n🧹 Starting cleanup process...\n');

    // Remove all unnecessary fields in one operation
    const unsetFields = {};
    FIELDS_TO_REMOVE.forEach(field => {
      unsetFields[field] = '';
    });

    const result = await Lead.updateMany(
      {},
      { $unset: unsetFields }
    );

    console.log('✅ Cleanup completed!');
    console.log(`   📝 Documents modified: ${result.modifiedCount}`);
    console.log(`   📝 Documents matched: ${result.matchedCount}\n`);

    // Verify cleanup
    console.log('🔍 Verifying cleanup...\n');
    let stillExists = false;
    for (const field of FIELDS_TO_REMOVE) {
      const count = await Lead.countDocuments({ [field]: { $exists: true } });
      if (count > 0) {
        console.log(`   ⚠️  ${field}: Still exists in ${count} leads`);
        stillExists = true;
      }
    }

    if (!stillExists) {
      console.log('✅ All unnecessary fields successfully removed!\n');
      
      // Show sample lead structure
      const sampleLead = await Lead.findOne().lean();
      if (sampleLead) {
        console.log('📄 Sample lead structure after cleanup:');
        console.log('   Fields present:', Object.keys(sampleLead).filter(k => k !== '__v').join(', '));
      }
    }

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    console.log('\n🎉 Cleanup process completed successfully!');
    console.log('\n⚠️  IMPORTANT: Update your Lead model to remove these fields from schema');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run cleanup
console.log('╔═══════════════════════════════════════════════════╗');
console.log('║   DATABASE CLEANUP - Remove Unnecessary Fields   ║');
console.log('╚═══════════════════════════════════════════════════╝\n');
console.log('⚠️  WARNING: This will remove deprecated fields from all leads');
console.log('📦 Make sure you have a backup of your database!\n');

// Auto-run after 3 seconds
setTimeout(() => {
  removeUnnecessaryFields();
}, 3000);

console.log('⏳ Starting in 3 seconds... Press Ctrl+C to cancel\n');

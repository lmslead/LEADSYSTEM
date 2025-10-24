const mongoose = require('mongoose');
const Lead = require('./models/Lead');

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

async function migrateImmediateEnrollmentToSale() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all leads with leadProgressStatus 'Immediate Enrollment'
    const leadsToUpdate = await Lead.find({ leadProgressStatus: 'Immediate Enrollment' });
    
    console.log(`📊 Found ${leadsToUpdate.length} leads with 'Immediate Enrollment' status`);
    
    if (leadsToUpdate.length === 0) {
      console.log('✅ No leads to migrate. All leads are already updated.');
      return;
    }

    // Show sample of leads that will be updated
    console.log('\n📋 Sample of leads to be updated:');
    leadsToUpdate.slice(0, 5).forEach(lead => {
      console.log(`  - Lead ID: ${lead.leadId}, Name: ${lead.name}, Status: ${lead.leadProgressStatus}`);
    });

    if (leadsToUpdate.length > 5) {
      console.log(`  ... and ${leadsToUpdate.length - 5} more leads`);
    }

    // Ask for confirmation (in a real script, you might want to prompt)
    console.log('\n🚀 Starting migration...');

    // Update all leads with 'Immediate Enrollment' to 'SALE'
    const updateResult = await Lead.updateMany(
      { leadProgressStatus: 'Immediate Enrollment' },
      { 
        $set: { 
          leadProgressStatus: 'SALE',
          updatedAt: new Date()
        }
      }
    );

    console.log(`\n✅ Migration completed successfully!`);
    console.log(`📊 Updated ${updateResult.modifiedCount} leads`);
    console.log(`📊 Matched ${updateResult.matchedCount} leads`);

    // Verify the migration
    const remainingImmediateEnrollment = await Lead.countDocuments({ leadProgressStatus: 'Immediate Enrollment' });
    const newSaleCount = await Lead.countDocuments({ leadProgressStatus: 'SALE' });

    console.log(`\n🔍 Verification:`);
    console.log(`  - Remaining 'Immediate Enrollment' leads: ${remainingImmediateEnrollment}`);
    console.log(`  - Total 'SALE' leads: ${newSaleCount}`);

    if (remainingImmediateEnrollment === 0) {
      console.log('✅ Migration verified successfully! All "Immediate Enrollment" leads have been converted to "SALE"');
    } else {
      console.log('⚠️  Warning: Some "Immediate Enrollment" leads were not migrated');
    }

    // Show updated sample
    console.log('\n📋 Sample of updated leads:');
    const updatedLeads = await Lead.find({ leadProgressStatus: 'SALE' }).limit(5);
    updatedLeads.forEach(lead => {
      console.log(`  - Lead ID: ${lead.leadId}, Name: ${lead.name}, Status: ${lead.leadProgressStatus}`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run the migration
if (require.main === module) {
  migrateImmediateEnrollmentToSale()
    .then(() => {
      console.log('\n🎉 Migration script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = migrateImmediateEnrollmentToSale;
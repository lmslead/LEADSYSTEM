/**
 * Database Migration Script: Persistent Leads Feature
 * 
 * This script ensures all leads in the database have the proper status fields
 * for the persistent leads feature to work correctly.
 * 
 * What this script does:
 * 1. Sets default qualificationStatus to 'pending' for leads without this field
 * 2. Sets default leadProgressStatus based on assignment status
 * 3. Ensures assigned leads have proper status for persistence
 * 4. Adds lastUpdatedBy and lastUpdatedAt fields where missing
 * 
 * Run this script ONCE after deploying the persistent leads feature.
 */

const mongoose = require('mongoose');
const Lead = require('./models/Lead');
const User = require('./models/User');
const { getEasternNow } = require('./utils/timeFilters');
require('dotenv').config();

async function migratePersistentLeadsFeature() {
  try {
    console.log('🚀 Starting Persistent Leads Feature Migration...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Get all leads
    const allLeads = await Lead.find({});
    console.log(`📊 Found ${allLeads.length} leads to migrate`);

    let updatedCount = 0;
    let skippedCount = 0;
    let assignedLeadsCount = 0;
    let unassignedLeadsCount = 0;

    for (const lead of allLeads) {
      let needsUpdate = false;
      const updates = {};

      // 1. Set default qualificationStatus if missing
      if (!lead.qualificationStatus) {
        updates.qualificationStatus = 'pending'; // Default for new persistent feature
        needsUpdate = true;
      }

      // 2. Set leadProgressStatus based on assignment status
      if (!lead.leadProgressStatus) {
        if (lead.assignedTo) {
          // If lead is assigned, set to 'Callback Needed' for persistence
          updates.leadProgressStatus = 'Callback Needed';
          assignedLeadsCount++;
        } else {
          // If not assigned, set to null (will be set when assigned)
          updates.leadProgressStatus = null;
          unassignedLeadsCount++;
        }
        needsUpdate = true;
      }

      // 3. Add lastUpdatedBy and lastUpdatedAt if missing
      if (!lead.lastUpdatedBy && lead.assignedTo) {
        // Try to get the name of who assigned it
        const assignedBy = await User.findById(lead.assignedBy);
        updates.lastUpdatedBy = assignedBy ? assignedBy.name : 'System Migration';
        needsUpdate = true;
      }

      if (!lead.lastUpdatedAt && lead.assignedAt) {
        updates.lastUpdatedAt = lead.assignedAt; // Use assignment date as last update
        needsUpdate = true;
      }

      // 4. Apply updates if needed
      if (needsUpdate) {
        await Lead.findByIdAndUpdate(lead._id, updates, { new: true });
        updatedCount++;
        
        // Log progress every 100 leads
        if (updatedCount % 100 === 0) {
          console.log(`⏳ Processed ${updatedCount} leads...`);
        }
      } else {
        skippedCount++;
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`✅ Total leads processed: ${allLeads.length}`);
    console.log(`🔄 Leads updated: ${updatedCount}`);
    console.log(`⏭️  Leads skipped (already correct): ${skippedCount}`);
    console.log(`👤 Assigned leads set to 'Callback Needed': ${assignedLeadsCount}`);
    console.log(`📝 Unassigned leads (no progress status): ${unassignedLeadsCount}`);

    // Verify the migration worked
    console.log('\n🔍 Verification:');
    
    const pendingQualificationCount = await Lead.countDocuments({ 
      qualificationStatus: 'pending',
      assignedTo: { $exists: true, $ne: null }
    });
    
    const callbackNeededCount = await Lead.countDocuments({ 
      leadProgressStatus: 'Callback Needed',
      assignedTo: { $exists: true, $ne: null }
    });

    console.log(`📋 Leads with pending qualification status (assigned): ${pendingQualificationCount}`);
    console.log(`📞 Leads with callback needed status (assigned): ${callbackNeededCount}`);

    // Check for Agent2 users to show relevant info
    const agent2Users = await User.find({ role: 'agent2' }).select('name email');
    console.log(`\n👥 Agent2 users who will see persistent leads: ${agent2Users.length}`);
    agent2Users.forEach(agent => {
      console.log(`   - ${agent.name} (${agent.email})`);
    });

    console.log('\n🎉 Migration completed successfully!');
    console.log('💡 Tips:');
    console.log('   - Agent2 users will now see persistent leads in their dashboard');
    console.log('   - Leads will remain visible until status is updated');
    console.log('   - Check the Agent2 dashboard to verify the feature is working');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Handle script execution
if (require.main === module) {
  migratePersistentLeadsFeature()
    .then(() => {
      console.log('✅ Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migratePersistentLeadsFeature };
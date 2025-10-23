/**
 * Database Verification Script: Persistent Leads Feature
 * 
 * This script checks the current state of your database to see what needs
 * to be updated for the persistent leads feature.
 * 
 * Run this script BEFORE the migration to see what will be changed.
 */

const mongoose = require('mongoose');
const Lead = require('./models/Lead');
const User = require('./models/User');
require('dotenv').config();

async function verifyDatabaseForPersistentLeads() {
  try {
    console.log('🔍 Verifying Database for Persistent Leads Feature...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Get database statistics
    const totalLeads = await Lead.countDocuments({});
    const assignedLeads = await Lead.countDocuments({ assignedTo: { $exists: true, $ne: null } });
    const unassignedLeads = totalLeads - assignedLeads;

    console.log('\n📊 Current Database State:');
    console.log(`📋 Total leads: ${totalLeads}`);
    console.log(`👤 Assigned leads: ${assignedLeads}`);
    console.log(`📝 Unassigned leads: ${unassignedLeads}`);

    // Check qualification status field
    const leadsWithQualificationStatus = await Lead.countDocuments({ 
      qualificationStatus: { $exists: true, $ne: null } 
    });
    const leadsWithoutQualificationStatus = totalLeads - leadsWithQualificationStatus;

    console.log('\n🏷️  Qualification Status Field:');
    console.log(`✅ Leads with qualificationStatus: ${leadsWithQualificationStatus}`);
    console.log(`❌ Leads missing qualificationStatus: ${leadsWithoutQualificationStatus}`);

    if (leadsWithQualificationStatus > 0) {
      const qualificationBreakdown = await Lead.aggregate([
        { $match: { qualificationStatus: { $exists: true, $ne: null } } },
        { $group: { _id: '$qualificationStatus', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      console.log('   Breakdown:');
      qualificationBreakdown.forEach(item => {
        console.log(`   - ${item._id}: ${item.count}`);
      });
    }

    // Check lead progress status field
    const leadsWithProgressStatus = await Lead.countDocuments({ 
      leadProgressStatus: { $exists: true, $ne: null } 
    });
    const leadsWithoutProgressStatus = totalLeads - leadsWithProgressStatus;

    console.log('\n📈 Lead Progress Status Field:');
    console.log(`✅ Leads with leadProgressStatus: ${leadsWithProgressStatus}`);
    console.log(`❌ Leads missing leadProgressStatus: ${leadsWithoutProgressStatus}`);

    if (leadsWithProgressStatus > 0) {
      const progressBreakdown = await Lead.aggregate([
        { $match: { leadProgressStatus: { $exists: true, $ne: null } } },
        { $group: { _id: '$leadProgressStatus', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      console.log('   Breakdown:');
      progressBreakdown.forEach(item => {
        console.log(`   - ${item._id}: ${item.count}`);
      });
    }

    // Check assignment tracking fields
    const leadsWithLastUpdatedBy = await Lead.countDocuments({ 
      lastUpdatedBy: { $exists: true, $ne: null } 
    });
    const leadsWithLastUpdatedAt = await Lead.countDocuments({ 
      lastUpdatedAt: { $exists: true, $ne: null } 
    });

    console.log('\n🔄 Assignment Tracking Fields:');
    console.log(`✅ Leads with lastUpdatedBy: ${leadsWithLastUpdatedBy}`);
    console.log(`✅ Leads with lastUpdatedAt: ${leadsWithLastUpdatedAt}`);

    // Check what will be affected by migration
    const leadsNeedingQualificationStatus = await Lead.countDocuments({ 
      qualificationStatus: { $exists: false }
    });
    const leadsNeedingProgressStatus = await Lead.countDocuments({ 
      leadProgressStatus: { $exists: false }
    });
    const assignedLeadsNeedingUpdates = await Lead.countDocuments({
      assignedTo: { $exists: true, $ne: null },
      $or: [
        { qualificationStatus: { $exists: false } },
        { leadProgressStatus: { $exists: false } }
      ]
    });

    console.log('\n🚀 Migration Impact:');
    console.log(`📝 Leads that will get qualificationStatus: ${leadsNeedingQualificationStatus}`);
    console.log(`📈 Leads that will get leadProgressStatus: ${leadsNeedingProgressStatus}`);
    console.log(`👤 Assigned leads needing updates: ${assignedLeadsNeedingUpdates}`);

    // Check Agent2 users
    const agent2Users = await User.find({ role: 'agent2' }).select('name email organization');
    const agent2Count = agent2Users.length;

    console.log('\n👥 Agent2 Users (who will use persistent leads):');
    console.log(`📊 Total Agent2 users: ${agent2Count}`);
    
    if (agent2Count > 0) {
      for (const agent of agent2Users) {
        const assignedToAgent = await Lead.countDocuments({ assignedTo: agent._id });
        console.log(`   - ${agent.name} (${agent.email}): ${assignedToAgent} assigned leads`);
      }
    } else {
      console.log('   ⚠️  No Agent2 users found. Create Agent2 users to use the persistent leads feature.');
    }

    // Estimate persistent leads after migration
    const estimatedPendingQualification = await Lead.countDocuments({
      assignedTo: { $exists: true, $ne: null },
      $or: [
        { qualificationStatus: 'pending' },
        { qualificationStatus: { $exists: false } }
      ]
    });

    const estimatedCallbackNeeded = await Lead.countDocuments({
      assignedTo: { $exists: true, $ne: null },
      $or: [
        { leadProgressStatus: 'Callback Needed' },
        { leadProgressStatus: { $exists: false } }
      ]
    });

    console.log('\n🔮 Estimated Persistent Leads After Migration:');
    console.log(`📋 Pending Qualification leads: ${estimatedPendingQualification}`);
    console.log(`📞 Callback Needed leads: ${estimatedCallbackNeeded}`);

    console.log('\n✅ Verification completed!');
    console.log('\n💡 Next Steps:');
    if (leadsNeedingQualificationStatus > 0 || leadsNeedingProgressStatus > 0) {
      console.log('1. Run the migration script: node migrate-persistent-leads-feature.js');
      console.log('2. Test the Agent2 dashboard to verify persistent leads work');
      console.log('3. Assign some leads from Agent1 to Agent2 to test the flow');
    } else {
      console.log('✅ Your database is already ready for the persistent leads feature!');
      console.log('🎉 You can start using the feature immediately.');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Handle script execution
if (require.main === module) {
  verifyDatabaseForPersistentLeads()
    .then(() => {
      console.log('✅ Verification script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Verification script failed:', error);
      process.exit(1);
    });
}

module.exports = { verifyDatabaseForPersistentLeads };
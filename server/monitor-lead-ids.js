const mongoose = require('mongoose');
const Lead = require('./models/Lead');
const User = require('./models/User');
const Organization = require('./models/Organization');
require('dotenv').config();

const monitorLeadIds = async () => {
  try {
    console.log('📊 Lead ID Format Monitoring System');
    console.log('====================================');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Count old vs new format leads
    console.log('\n🔍 Analyzing Lead ID formats...');
    
    const oldFormatCount = await Lead.countDocuments({ 
      leadId: { $regex: /^LEAD\d{8}$/ } 
    });
    
    const oldOrgFormatCount = await Lead.countDocuments({ 
      leadId: { $regex: /^ORG\d{11}$/ } 
    });
    
    const newFormatCount = await Lead.countDocuments({ 
      leadId: { $regex: /^[A-Z]{3}\d{11}$/ } 
    });
    
    const totalWithLeadId = await Lead.countDocuments({ 
      leadId: { $exists: true, $ne: null, $ne: '' } 
    });
    
    const totalLeads = await Lead.countDocuments({});
    
    console.log('\n📈 Lead ID Format Statistics:');
    console.log(`   Old Format (LEAD########): ${oldFormatCount}`);
    console.log(`   Previous Format (ORG###########): ${oldOrgFormatCount}`);
    console.log(`   New Format ([ORG]###########): ${newFormatCount}`);
    console.log(`   Total with Lead ID: ${totalWithLeadId}`);
    console.log(`   Total Leads in System: ${totalLeads}`);
    console.log(`   Leads without Lead ID: ${totalLeads - totalWithLeadId}`);
    
    if (totalWithLeadId > 0) {
      const oldPercentage = ((oldFormatCount / totalWithLeadId) * 100).toFixed(2);
      const oldOrgPercentage = ((oldOrgFormatCount / totalWithLeadId) * 100).toFixed(2);
      const newPercentage = ((newFormatCount / totalWithLeadId) * 100).toFixed(2);
      console.log(`   Old Format Percentage: ${oldPercentage}%`);
      console.log(`   Previous Format Percentage: ${oldOrgPercentage}%`);
      console.log(`   New Dynamic Format Percentage: ${newPercentage}%`);
    }
    
    // Show recent new format leads
    console.log('\n📋 Recent Dynamic Format Leads (Last 10):');
    const recentNewLeads = await Lead.find({ 
      leadId: { $regex: /^[A-Z]{3}\d{11}$/ } 
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('leadId createdAt name email category status')
      .populate('assignedTo', 'name')
      .populate('organization', 'name');
      
    if (recentNewLeads.length > 0) {
      recentNewLeads.forEach((lead, index) => {
        const assignedTo = lead.assignedTo ? lead.assignedTo.name : 'Unassigned';
        const org = lead.organization ? lead.organization.name : 'No Org';
        const prefix = lead.leadId.substring(0, 3);
        console.log(`   ${index + 1}. ${lead.leadId} - ${lead.name}`);
        console.log(`      Created: ${lead.createdAt.toDateString()}`);
        console.log(`      Status: ${lead.status} | Category: ${lead.category}`);
        console.log(`      Prefix: ${prefix} | Org: ${org}`);
        console.log(`      Assigned to: ${assignedTo}`);
        console.log('');
      });
    } else {
      console.log('   No dynamic format leads found yet');
    }
    
    // Show recent old format leads for comparison
    console.log('📋 Recent Old Format Leads (Last 5):');
    const recentOldLeads = await Lead.find({ 
      leadId: { $regex: /^LEAD\d{8}$/ } 
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('leadId createdAt name email category status')
      .populate('assignedTo', 'name')
      .populate('organization', 'name');
      
    if (recentOldLeads.length > 0) {
      recentOldLeads.forEach((lead, index) => {
        const assignedTo = lead.assignedTo ? lead.assignedTo.name : 'Unassigned';
        const org = lead.organization ? lead.organization.name : 'No Org';
        console.log(`   ${index + 1}. ${lead.leadId} - ${lead.name}`);
        console.log(`      Created: ${lead.createdAt.toDateString()}`);
        console.log(`      Status: ${lead.status} | Category: ${lead.category}`);
        console.log(`      Assigned to: ${assignedTo} | Org: ${org}`);
        console.log('');
      });
    } else {
      console.log('   No old format leads found');
    }
    
    // Check for any invalid formats
    console.log('🔍 Checking for Invalid Lead ID formats...');
    const allLeadsWithId = await Lead.find({ 
      leadId: { $exists: true, $ne: null, $ne: '' } 
    }).select('leadId');
    
    let invalidCount = 0;
    const invalidLeads = [];
    
    allLeadsWithId.forEach(lead => {
      const oldFormatValid = /^LEAD\d{8}$/.test(lead.leadId);
      const oldOrgFormatValid = /^ORG\d{11}$/.test(lead.leadId);
      const newFormatValid = /^[A-Z]{3}\d{11}$/.test(lead.leadId);
      
      if (!oldFormatValid && !oldOrgFormatValid && !newFormatValid) {
        invalidCount++;
        invalidLeads.push(lead.leadId);
      }
    });
    
    if (invalidCount > 0) {
      console.log(`❌ Found ${invalidCount} leads with invalid Lead ID formats:`);
      invalidLeads.slice(0, 5).forEach(leadId => {
        console.log(`   - ${leadId}`);
      });
      if (invalidLeads.length > 5) {
        console.log(`   ... and ${invalidLeads.length - 5} more`);
      }
    } else {
      console.log('✅ All Lead IDs have valid formats');
    }
    
    // Today's leads analysis
    console.log('\n📅 Today\'s Lead Generation Analysis:');
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    const todayLeadsCount = await Lead.countDocuments({
      createdAt: { $gte: startOfDay, $lt: endOfDay }
    });
    
    const todayNewFormat = await Lead.countDocuments({
      leadId: { $regex: /^[A-Z]{3}\d{11}$/ },
      createdAt: { $gte: startOfDay, $lt: endOfDay }
    });
    
    const todayOldFormat = await Lead.countDocuments({
      leadId: { $regex: /^LEAD\d{8}$/ },
      createdAt: { $gte: startOfDay, $lt: endOfDay }
    });
    
    console.log(`   Total leads created today: ${todayLeadsCount}`);
    console.log(`   Dynamic format ([ORG]) today: ${todayNewFormat}`);
    console.log(`   Old format (LEAD) today: ${todayOldFormat}`);
    console.log(`   Daily capacity per organization: 99999`);
    
    if (todayLeadsCount > 0) {
      const newFormatTodayPercentage = ((todayNewFormat / todayLeadsCount) * 100).toFixed(2);
      console.log(`   Dynamic format percentage today: ${newFormatTodayPercentage}%`);
    }
    
    // System health check
    console.log('\n🏥 System Health Check:');
    
    // Check for duplicate Lead IDs
    const duplicateCheck = await Lead.aggregate([
      { $match: { leadId: { $exists: true, $ne: null, $ne: '' } } },
      { $group: { _id: '$leadId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]);
    
    if (duplicateCheck.length > 0) {
      console.log(`❌ Found ${duplicateCheck.length} duplicate Lead IDs:`);
      duplicateCheck.slice(0, 5).forEach(dup => {
        console.log(`   - ${dup._id} (appears ${dup.count} times)`);
      });
    } else {
      console.log('✅ No duplicate Lead IDs found');
    }
    
    // Check for missing Lead IDs
    const missingLeadIds = await Lead.countDocuments({
      $or: [
        { leadId: { $exists: false } },
        { leadId: null },
        { leadId: '' }
      ]
    });
    
    if (missingLeadIds > 0) {
      console.log(`⚠️  Found ${missingLeadIds} leads without Lead IDs`);
    } else {
      console.log('✅ All leads have Lead IDs assigned');
    }
    
    // Performance metrics
    console.log('\n⚡ Performance Metrics:');
    const indexInfo = await Lead.collection.getIndexes();
    const hasLeadIdIndex = Object.keys(indexInfo).some(key => 
      key.includes('leadId') || indexInfo[key].some(field => field[0] === 'leadId')
    );
    
    console.log(`   Lead ID index exists: ${hasLeadIdIndex ? '✅ Yes' : '❌ No'}`);
    console.log(`   Total indexes: ${Object.keys(indexInfo).length}`);
    
    console.log('\n🎉 Monitoring completed successfully!');
    console.log('=======================================');
    
  } catch (error) {
    console.error('❌ Monitoring failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

// Run with different modes
const runWithMode = async (mode) => {
  switch (mode) {
    case 'quick':
      // Quick check - just format statistics
      await quickCheck();
      break;
    case 'full':
    default:
      // Full monitoring
      await monitorLeadIds();
      break;
  }
};

const quickCheck = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const oldCount = await Lead.countDocuments({ leadId: /^LEAD\d{8}$/ });
    const newCount = await Lead.countDocuments({ leadId: /^[A-Z]{3}\d{11}$/ });
    const total = await Lead.countDocuments({});
    
    console.log(`📊 Quick Stats: Old: ${oldCount}, New: ${newCount}, Total: ${total}`);
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('Quick check failed:', error.message);
  }
};

// Command line interface
const mode = process.argv[2] || 'full';

if (require.main === module) {
  runWithMode(mode);
}

module.exports = { monitorLeadIds, quickCheck };
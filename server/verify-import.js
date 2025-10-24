const mongoose = require('mongoose');
const Lead = require('./models/Lead');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/papadms';

async function verifyImport() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find all leads with RED251024 prefix (imported today)
    const leads = await Lead.find({ leadId: /^RED251024/ })
      .sort({ leadId: 1 })
      .select('leadId firstName lastName phoneNumber leadProgressStatus createdAt');
    
    console.log('\n📊 Imported Leads Verification:');
    console.log('================================\n');
    
    // Show first 10
    console.log('First 10 leads:');
    leads.slice(0, 10).forEach(lead => {
      console.log(`  ${lead.leadId}: ${lead.firstName} ${lead.lastName} - ${lead.leadProgressStatus} - ${lead.createdAt.toISOString().split('T')[0]}`);
    });
    
    // Show last 10
    console.log('\nLast 10 leads:');
    leads.slice(-10).forEach(lead => {
      console.log(`  ${lead.leadId}: ${lead.firstName} ${lead.lastName} - ${lead.leadProgressStatus} - ${lead.createdAt.toISOString().split('T')[0]}`);
    });
    
    console.log(`\n✅ Total leads imported with RED251024 prefix: ${leads.length}`);
    
    // Verify sequence is correct
    let sequenceErrors = 0;
    for (let i = 0; i < leads.length; i++) {
      const expectedSequence = String(i + 1).padStart(5, '0');
      const actualSequence = leads[i].leadId.slice(-5);
      if (actualSequence !== expectedSequence) {
        console.log(`  ⚠️  Sequence error: Expected ${expectedSequence}, got ${actualSequence} for ${leads[i].leadId}`);
        sequenceErrors++;
      }
    }
    
    if (sequenceErrors === 0) {
      console.log('✅ All lead IDs have correct sequential numbering!');
    } else {
      console.log(`❌ Found ${sequenceErrors} sequence errors`);
    }
    
    // Count by status
    const statusCounts = await Lead.aggregate([
      { $match: { leadId: /^RED251024/ } },
      { $group: { _id: '$leadProgressStatus', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    console.log('\n📈 Leads by Progress Status:');
    statusCounts.forEach(s => {
      console.log(`  ${s._id}: ${s.count}`);
    });
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyImport();

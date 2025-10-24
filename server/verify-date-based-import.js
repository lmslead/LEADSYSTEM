const mongoose = require('mongoose');
const Lead = require('./models/Lead');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/papadms';

async function verifyDateBasedImport() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find all leads from RED organization starting with RED2510
    const leads = await Lead.find({ leadId: /^RED2510/ })
      .sort({ createdAt: 1, leadId: 1 })
      .select('leadId name createdAt leadProgressStatus');
    
    console.log('\n📊 Imported Leads by Date:');
    console.log('==========================\n');
    
    // Group by date
    const byDate = new Map();
    leads.forEach(lead => {
      const dateKey = lead.createdAt.toISOString().split('T')[0];
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, []);
      }
      byDate.get(dateKey).push(lead);
    });
    
    // Display grouped by date
    const sortedDates = Array.from(byDate.keys()).sort();
    for (const dateKey of sortedDates) {
      const dateLeads = byDate.get(dateKey);
      console.log(`\n📅 ${dateKey} (${dateLeads.length} leads):`);
      console.log(`   First: ${dateLeads[0].leadId} - ${dateLeads[0].name}`);
      console.log(`   Last:  ${dateLeads[dateLeads.length - 1].leadId} - ${dateLeads[dateLeads.length - 1].name}`);
    }
    
    console.log(`\n✅ Total leads imported: ${leads.length}`);
    
    // Show sample from different dates
    console.log('\n📋 Sample leads from different dates:');
    for (const dateKey of sortedDates.slice(0, 5)) {
      const sample = byDate.get(dateKey)[0];
      console.log(`  ${sample.leadId}: ${sample.name} - ${dateKey} - ${sample.leadProgressStatus || 'pending'}`);
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyDateBasedImport();

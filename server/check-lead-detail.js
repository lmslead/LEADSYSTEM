const mongoose = require('mongoose');
const Lead = require('./models/Lead');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/papadms';

async function checkLeadDetail() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Get a sample lead
    const lead = await Lead.findOne({ leadId: 'RED25102400005' });
    
    console.log('\n📋 Sample Lead Details (RED25102400005):');
    console.log('=========================================\n');
    console.log(JSON.stringify(lead, null, 2));
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkLeadDetail();

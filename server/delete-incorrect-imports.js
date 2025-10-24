const mongoose = require('mongoose');
const Lead = require('./models/Lead');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/papadms';

async function deleteIncorrectImports() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Delete all leads with RED251024 prefix (imported today incorrectly)
    const result = await Lead.deleteMany({ leadId: /^RED251024/ });
    
    console.log(`\n🗑️  Deleted ${result.deletedCount} leads with incorrect dates`);
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

deleteIncorrectImports();

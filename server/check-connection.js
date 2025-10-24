require('dotenv').config();
const mongoose = require('mongoose');

async function checkConnection() {
  try {
    console.log('Connecting to:', process.env.MONGODB_URI.replace(/:[^:@]+@/, ':****@'));
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB successfully');
    
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    console.log(`\n📂 Collections in database:`);
    for (const coll of collections) {
      const count = await db.collection(coll.name).countDocuments();
      console.log(`  - ${coll.name}: ${count} documents`);
    }
    
  } catch (error) {
    console.error('❌ Connection error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

checkConnection();

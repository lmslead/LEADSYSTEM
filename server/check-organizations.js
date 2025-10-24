const mongoose = require('mongoose');
const Organization = require('./models/Organization');
const User = require('./models/User');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

async function checkAndCreateOrganization() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check for super admin user
    let superAdmin = await User.findOne({ role: 'super-admin' });
    if (!superAdmin) {
      console.log('⚠️  No super admin found. Creating temporary super admin...\n');
      superAdmin = new User({
        username: 'System Admin',
        email: 'admin@system.com',
        password: 'TempPassword123!',
        role: 'super-admin',
        isActive: true
      });
      await superAdmin.save();
      console.log(`✅ Created temporary super admin: ${superAdmin.username}\n`);
    } else {
      console.log(`✅ Found super admin: ${superAdmin.username}\n`);
    }

    // Check existing organizations
    const orgs = await Organization.find({});
    console.log(`📊 Found ${orgs.length} organization(s) in database:`);
    orgs.forEach(org => {
      console.log(`   - ${org.name} (Prefix: ${org.orgPrefix}, ID: ${org._id})`);
    });
    console.log('');

    // Check if REDDINGTON GLOBAL CONSULTANCY exists
    let reddington = await Organization.findOne({ 
      name: { $regex: /REDDINGTON GLOBAL CONSULTANCY/i } 
    });

    if (!reddington) {
      console.log('❌ REDDINGTON GLOBAL CONSULTANCY not found. Creating it now...\n');
      
      reddington = new Organization({
        name: 'REDDINGTON GLOBAL CONSULTANCY',
        orgPrefix: 'RED',
        contactEmail: 'admin@reddington.com',
        contactPhone: '1234567890',
        isActive: true,
        createdBy: superAdmin._id
      });
      
      await reddington.save();
      console.log(`✅ Created organization: ${reddington.name}`);
      console.log(`   - Prefix: ${reddington.orgPrefix}`);
      console.log(`   - ID: ${reddington._id}`);
    } else {
      console.log(`✅ REDDINGTON GLOBAL CONSULTANCY exists:`);
      console.log(`   - Name: ${reddington.name}`);
      console.log(`   - Prefix: ${reddington.orgPrefix}`);
      console.log(`   - ID: ${reddington._id}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

if (require.main === module) {
  checkAndCreateOrganization()
    .then(() => {
      console.log('\n🎉 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = checkAndCreateOrganization;

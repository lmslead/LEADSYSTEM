const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import models
const User = require('./models/User');
const Organization = require('./models/Organization');
const Lead = require('./models/Lead');

const importDatabase = async (exportFolderName) => {
  try {
    if (!exportFolderName) {
      console.error('❌ Please provide export folder name');
      console.log('Usage: node import-database.js <export-folder-name>');
      console.log('Example: node import-database.js export-2025-09-11T10-30-00-000Z');
      process.exit(1);
    }

    const exportPath = path.join(__dirname, 'database-export', exportFolderName);
    
    // Check if export folder exists
    if (!fs.existsSync(exportPath)) {
      console.error(`❌ Export folder not found: ${exportPath}`);
      process.exit(1);
    }

    // Read export summary
    const summaryPath = path.join(exportPath, 'export-summary.json');
    if (!fs.existsSync(summaryPath)) {
      console.error('❌ Export summary not found. Invalid export folder.');
      process.exit(1);
    }

    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    console.log('📋 Export Summary:');
    console.log(`   Export Date: ${summary.exportDate}`);
    console.log(`   Total Records: ${summary.totalRecords}`);
    console.log(`   Collections: ${Object.keys(summary.collections).length}`);

    // Connect to target database
    console.log('\n🔌 Connecting to target database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to target database');

    // Check if target database is empty (safety check)
    const existingUsers = await User.countDocuments();
    const existingOrgs = await Organization.countDocuments();
    const existingLeads = await Lead.countDocuments();

    if (existingUsers > 0 || existingOrgs > 0 || existingLeads > 0) {
      console.log('⚠️  Target database is not empty:');
      console.log(`   Users: ${existingUsers}`);
      console.log(`   Organizations: ${existingOrgs}`);
      console.log(`   Leads: ${existingLeads}`);
      
      // Ask for confirmation (in production, you might want to require --force flag)
      console.log('\n❗ WARNING: This will add data to existing collections.');
      console.log('   To proceed safely, ensure target database is empty.');
      console.log('   Or use --force flag to proceed anyway.');
      
      if (!process.argv.includes('--force')) {
        console.log('❌ Import cancelled for safety. Use --force to override.');
        process.exit(1);
      }
    }

    console.log('\n📤 Starting import process...');

    // Import Organizations first (referenced by users and leads)
    if (fs.existsSync(path.join(exportPath, 'organizations.json'))) {
      console.log('\n📥 Importing Organizations...');
      const orgData = JSON.parse(fs.readFileSync(path.join(exportPath, 'organizations.json'), 'utf8'));
      
      if (orgData.data && orgData.data.length > 0) {
        // Clear existing organizations if force flag is used
        if (process.argv.includes('--force')) {
          await Organization.deleteMany({});
          console.log('🗑️  Cleared existing organizations');
        }

        // Import organizations while preserving ObjectIds
        for (const org of orgData.data) {
          try {
            await Organization.create(org);
          } catch (error) {
            if (error.code === 11000) {
              console.log(`⚠️  Organization ${org.name} already exists, skipping...`);
            } else {
              throw error;
            }
          }
        }
        console.log(`✅ Imported ${orgData.data.length} organizations`);
      }
    }

    // Import Users second (may reference organizations)
    if (fs.existsSync(path.join(exportPath, 'users.json'))) {
      console.log('\n📥 Importing Users...');
      const userData = JSON.parse(fs.readFileSync(path.join(exportPath, 'users.json'), 'utf8'));
      
      if (userData.data && userData.data.length > 0) {
        // Clear existing users if force flag is used
        if (process.argv.includes('--force')) {
          await User.deleteMany({});
          console.log('🗑️  Cleared existing users');
        }

        // Import users (passwords are already hashed in export)
        for (const user of userData.data) {
          try {
            // Create user without triggering pre-save hook (password already hashed)
            const newUser = new User(user);
            newUser.isNew = false; // Prevent pre-save hooks
            await newUser.save({ validateBeforeSave: false });
          } catch (error) {
            if (error.code === 11000) {
              console.log(`⚠️  User ${user.email} already exists, skipping...`);
            } else {
              console.error(`❌ Error importing user ${user.email}:`, error.message);
            }
          }
        }
        console.log(`✅ Imported ${userData.data.length} users`);
      }
    }

    // Import Leads last (may reference users and organizations)
    if (fs.existsSync(path.join(exportPath, 'leads.json'))) {
      console.log('\n📥 Importing Leads...');
      const leadData = JSON.parse(fs.readFileSync(path.join(exportPath, 'leads.json'), 'utf8'));
      
      if (leadData.data && leadData.data.length > 0) {
        // Clear existing leads if force flag is used
        if (process.argv.includes('--force')) {
          await Lead.deleteMany({});
          console.log('🗑️  Cleared existing leads');
        }

        // Import leads in batches for better performance
        const batchSize = 100;
        for (let i = 0; i < leadData.data.length; i += batchSize) {
          const batch = leadData.data.slice(i, i + batchSize);
          try {
            await Lead.insertMany(batch, { ordered: false });
            console.log(`   Imported batch ${Math.floor(i/batchSize) + 1} (${batch.length} leads)`);
          } catch (error) {
            // Handle duplicate errors
            if (error.writeErrors) {
              const duplicates = error.writeErrors.filter(e => e.code === 11000).length;
              const successful = batch.length - duplicates;
              console.log(`   Batch ${Math.floor(i/batchSize) + 1}: ${successful} imported, ${duplicates} duplicates skipped`);
            } else {
              throw error;
            }
          }
        }
        console.log(`✅ Imported leads data`);
      }
    }

    // Verify import
    console.log('\n🔍 Verifying import...');
    const finalUsers = await User.countDocuments();
    const finalOrgs = await Organization.countDocuments();
    const finalLeads = await Lead.countDocuments();

    console.log('\n🎉 Import completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Final Database State:');
    console.log(`   👥 Users: ${finalUsers}`);
    console.log(`   🏢 Organizations: ${finalOrgs}`);
    console.log(`   📋 Leads: ${finalLeads}`);
    console.log(`   📈 Total Records: ${finalUsers + finalOrgs + finalLeads}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Verify super admins
    const superAdmins = await User.find({ role: 'superadmin' }).select('name email');
    if (superAdmins.length > 0) {
      console.log('\n👑 Super Admins Available:');
      superAdmins.forEach(admin => {
        console.log(`   - ${admin.name} (${admin.email})`);
      });
    }

  } catch (error) {
    console.error('❌ Import failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
};

// Get export folder name from command line arguments
const exportFolderName = process.argv[2];

console.log('🚀 Starting database import...');
importDatabase(exportFolderName);

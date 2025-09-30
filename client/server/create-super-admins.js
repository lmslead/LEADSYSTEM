const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Organization = require('./models/Organization');
require('dotenv').config();

const createSuperAdmins = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Super admin users to create
    const superAdmins = [
      {
        name: 'Vishal',
        email: 'vishal@lms.com',
        password: '@dm!n123',
        role: 'superadmin'
      },
      {
        name: 'Jitin',
        email: 'jitin@lms.com',
        password: '@dm!n123',
        role: 'superadmin'
      },
      {
        name: 'Jyotsana',
        email: 'jyotsana@lms.com',
        password: '@dm!n123',
        role: 'superadmin'
      }
    ];

    console.log('Creating super admin users...\n');

    for (const adminData of superAdmins) {
      try {
        // Check if user already exists
        const existingUser = await User.findOne({ email: adminData.email });
        
        if (existingUser) {
          console.log(`❌ User with email ${adminData.email} already exists`);
          console.log(`   Current role: ${existingUser.role}`);
          
          // Update to superadmin if not already
          if (existingUser.role !== 'superadmin') {
            existingUser.role = 'superadmin';
            await existingUser.save();
            console.log(`✅ Updated ${adminData.email} role to superadmin`);
          }
          continue;
        }

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(adminData.password, salt);

        // Create the user
        const newUser = new User({
          name: adminData.name,
          email: adminData.email,
          password: hashedPassword,
          role: adminData.role,
          isActive: true,
          createdAt: new Date(),
          // Super admins don't need to be associated with a specific organization
          organization: null
        });

        await newUser.save();
        console.log(`✅ Created super admin: ${adminData.name} (${adminData.email})`);
        console.log(`   Role: ${newUser.role}`);
        console.log(`   ID: ${newUser._id}`);
        console.log('');

      } catch (error) {
        console.error(`❌ Error creating ${adminData.email}:`, error.message);
      }
    }

    // Verify all super admins
    console.log('\n--- Verification ---');
    const allSuperAdmins = await User.find({ role: 'superadmin' }).select('name email role isActive');
    console.log(`Total super admins in database: ${allSuperAdmins.length}`);
    
    allSuperAdmins.forEach(admin => {
      console.log(`- ${admin.name} (${admin.email}) - Active: ${admin.isActive}`);
    });

    console.log('\n✅ Super admin creation process completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }
};

// Run the script
createSuperAdmins();

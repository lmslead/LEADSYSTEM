const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

const fixSuperAdminPasswords = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const targetPassword = '@dm!n123';
    const superAdmins = [
      { email: 'vishal@lms.com', name: 'Vishal Super Admin' },
      { email: 'jitin@lms.com', name: 'Jitin Super Admin' },
      { email: 'jyotsana@lms.com', name: 'Jyotsana Super Admin' }
    ];

    console.log('Setting super admin passwords to: @dm!n123\n');

    for (const adminInfo of superAdmins) {
      try {
        // Find the user
        const user = await User.findOne({ email: adminInfo.email });
        
        if (!user) {
          console.log(`❌ User ${adminInfo.email} not found, creating...`);
          
          // Create new user
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(targetPassword, salt);
          
          const newUser = new User({
            name: adminInfo.name,
            email: adminInfo.email,
            password: hashedPassword,
            role: 'superadmin',
            isActive: true,
            createdAt: new Date()
          });
          
          await newUser.save();
          console.log(`✅ Created new super admin: ${adminInfo.name}`);
        } else {
          // Update existing user
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(targetPassword, salt);
          
          // Direct update
          await User.updateOne(
            { email: adminInfo.email },
            { 
              password: hashedPassword,
              role: 'superadmin',
              isActive: true
            }
          );
          
          console.log(`✅ Updated password for: ${user.name}`);
        }

        // Verify the password works
        const updatedUser = await User.findOne({ email: adminInfo.email });
        const isValid = await bcrypt.compare(targetPassword, updatedUser.password);
        console.log(`   Password test: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
        console.log(`   Role: ${updatedUser.role}`);
        console.log('');

      } catch (error) {
        console.error(`❌ Error with ${adminInfo.email}:`, error.message);
      }
    }

    // Test login for all
    console.log('\n--- Login Test ---');
    for (const adminInfo of superAdmins) {
      const user = await User.findOne({ email: adminInfo.email });
      if (user) {
        const loginTest = await bcrypt.compare(targetPassword, user.password);
        console.log(`${adminInfo.email}: ${loginTest ? '✅ Can Login' : '❌ Cannot Login'}`);
      }
    }

    console.log('\n🎉 Super Admin Credentials Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Email: vishal@lms.com     | Password: @dm!n123');
    console.log('Email: jitin@lms.com      | Password: @dm!n123');
    console.log('Email: jyotsana@lms.com   | Password: @dm!n123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  }
};

// Run the script
fixSuperAdminPasswords();

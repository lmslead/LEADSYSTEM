const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

const createSuperAdminsCorrectly = async () => {
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

    console.log('Setting super admin passwords (working with pre-save hook)...\n');

    for (const adminInfo of superAdmins) {
      try {
        // Find user including password field
        let user = await User.findOne({ email: adminInfo.email }).select('+password');
        
        if (!user) {
          console.log(`Creating new user: ${adminInfo.email}`);
          
          // Create new user - let the pre-save hook handle password hashing
          user = new User({
            name: adminInfo.name,
            email: adminInfo.email,
            password: targetPassword, // Plain text - will be hashed by pre-save hook
            role: 'superadmin',
            isActive: true
          });
        } else {
          console.log(`Updating existing user: ${adminInfo.email}`);
          
          // Update password - set plain text, let pre-save hook hash it
          user.password = targetPassword;
          user.role = 'superadmin';
          user.isActive = true;
        }

        // Save the user (pre-save hook will hash the password)
        await user.save();
        console.log(`✅ Saved user: ${user.name}`);

        // Test the password using the model's comparePassword method
        const userWithPassword = await User.findOne({ email: adminInfo.email }).select('+password');
        const isPasswordCorrect = await userWithPassword.comparePassword(targetPassword);
        
        console.log(`   Login test: ${isPasswordCorrect ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log(`   Role: ${userWithPassword.role}`);
        console.log(`   Active: ${userWithPassword.isActive}`);
        console.log('');

      } catch (error) {
        console.error(`❌ Error with ${adminInfo.email}:`, error.message);
      }
    }

    console.log('\n🎯 FINAL VERIFICATION - Testing Login Credentials');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    for (const adminInfo of superAdmins) {
      try {
        const user = await User.findOne({ email: adminInfo.email }).select('+password');
        if (user) {
          const canLogin = await user.comparePassword(targetPassword);
          console.log(`${adminInfo.email}: ${canLogin ? '✅ LOGIN WORKS' : '❌ LOGIN FAILED'}`);
        }
      } catch (error) {
        console.log(`${adminInfo.email}: ❌ ERROR - ${error.message}`);
      }
    }

    console.log('\n🎉 SUPER ADMIN CREDENTIALS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Email: vishal@lms.com      | Password: @dm!n123');
    console.log('Email: jitin@lms.com       | Password: @dm!n123');
    console.log('Email: jyotsana@lms.com    | Password: @dm!n123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Role: superadmin | Status: active');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  }
};

// Run the script
createSuperAdminsCorrectly();

const mongoose = require('mongoose');
const Lead = require('./models/Lead');
require('dotenv').config();

const testConversionRate = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check current counts - now only checking leadProgressStatus
    const totalLeads = await Lead.countDocuments();
    const qualifiedLeads = await Lead.countDocuments({ qualificationStatus: 'qualified' });
    const immediateEnrollmentLeads = await Lead.countDocuments({ 
      leadProgressStatus: 'Immediate Enrollment'
    });
    
    // Check individual counts for reference
    const callDispositionCount = await Lead.countDocuments({ callDisposition: 'Immediate Enrollment' });
    const leadProgressCount = await Lead.countDocuments({ leadProgressStatus: 'Immediate Enrollment' });

    console.log('Current Statistics:');
    console.log(`Total Leads: ${totalLeads}`);
    console.log(`Qualified Leads: ${qualifiedLeads}`);
    console.log(`Immediate Enrollment Leads (leadProgressStatus only): ${immediateEnrollmentLeads}`);
    console.log(`  - For reference, callDisposition count: ${callDispositionCount}`);
    console.log(`  - leadProgressStatus count: ${leadProgressCount}`);
    
    const conversionRate = qualifiedLeads > 0 ? ((immediateEnrollmentLeads / qualifiedLeads) * 100).toFixed(2) : 0;
    console.log(`Current Conversion Rate: ${conversionRate}%`);

    // If we have qualified leads but no immediate enrollment, let's update some leads for testing
    if (qualifiedLeads > 0 && immediateEnrollmentLeads === 0) {
      console.log('\nUpdating some qualified leads to have Immediate Enrollment call disposition...');
      
      const leadsToUpdate = await Lead.find({ 
        qualificationStatus: 'qualified',
        callDisposition: { $exists: false }
      }).limit(5);

      for (let lead of leadsToUpdate) {
        lead.callDisposition = 'Immediate Enrollment';
        await lead.save();
        console.log(`Updated lead ${lead.leadId} with Immediate Enrollment`);
      }

      // Recalculate using only leadProgressStatus
      const newImmediateEnrollmentLeads = await Lead.countDocuments({ 
        leadProgressStatus: 'Immediate Enrollment'
      });
      const newConversionRate = qualifiedLeads > 0 ? ((newImmediateEnrollmentLeads / qualifiedLeads) * 100).toFixed(2) : 0;
      console.log(`New Conversion Rate: ${newConversionRate}%`);
    }

    await mongoose.disconnect();
    console.log('Test completed');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

testConversionRate();

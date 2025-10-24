require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const Lead = require('./models/Lead');
const User = require('./models/User');
const Organization = require('./models/Organization');

// Organization ID for REDDINGTON GLOBAL CONSULTANCY  
const REDDINGTON_ORG_ID = '68b9c76d2c29dac1220cb81c';
const SYSTEM_USER_ID = '68b8631edb8d9f11eec45c7a'; // Default user for createdBy field

// Parse date in DD-MMM-YY format to JavaScript Date
function parseDate(dateStr) {
  if (!dateStr || dateStr === '-') return new Date();
  
  try {
    // Handle format like "03-Oct-25"
    const [day, monthStr, year] = dateStr.split('-');
    const monthMap = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    
    const month = monthMap[monthStr];
    const fullYear = 2000 + parseInt(year); // Convert 25 to 2025
    
    return new Date(fullYear, month, parseInt(day));
  } catch (error) {
    console.error('Error parsing date:', dateStr, error);
    return new Date();
  }
}

// Clean and normalize field values
function cleanValue(value) {
  if (!value || value === '-' || value === 'NRF') return null;
  return value.trim();
}

// Map CSV row to Lead schema
function mapCsvToLead(row, leadCounter, assignedAtDate) {
  // Use the "Assigned At" date from CSV for lead creation date
  const createdDate = parseDate(row['Assigned At']);
  
  // Generate Lead ID in format RED{YYMMDD}{NNNNN}
  const year = String(createdDate.getFullYear()).substring(2); // Get last 2 digits of year
  const month = String(createdDate.getMonth() + 1).padStart(2, '0');
  const day = String(createdDate.getDate()).padStart(2, '0');
  const sequence = String(leadCounter).padStart(5, '0');
  const leadId = `RED${year}${month}${day}${sequence}`;
  
  // Map qualification status
  let qualificationStatus = 'pending';
  if (row['Qualification Status']) {
    const status = row['Qualification Status'].toLowerCase().trim();
    if (status.includes('qualified') && !status.includes('not')) {
      qualificationStatus = 'qualified';
    } else if (status.includes('not') && status.includes('qualified')) {
      qualificationStatus = 'not-qualified';
    }
  }
  
  // Map category based on completion or default to cold
  let category = 'cold';
  if (row['Category'] && ['hot', 'warm', 'cold'].includes(row['Category'].toLowerCase())) {
    category = row['Category'].toLowerCase();
  }
  
  // Map credit score range
  let creditScoreRange = undefined; // Use undefined instead of null
  if (row['Credit Score Range'] && row['Credit Score Range'] !== '-') {
    const range = row['Credit Score Range'].trim();
    // Only set if it matches one of the valid enum values
    if (['300-549', '550-649', '650-699', '700-749', '750-850'].includes(range)) {
      creditScoreRange = range;
    }
  }
  
  // Map debt category
  let debtCategory = 'unsecured'; // Default
  if (row['Debt Category']) {
    const debtCat = row['Debt Category'].toLowerCase().trim();
    if (debtCat === 'secured' || debtCat === 'unsecured') {
      debtCategory = debtCat;
    }
  }
  
  // Build the lead object
  const lead = {
    leadId: leadId,
    name: cleanValue(row['Name']) || 'Unknown',
    email: cleanValue(row['Email']),
    phone: cleanValue(row['Phone']),
    alternatePhone: cleanValue(row['Alternate Phone']),
    address: cleanValue(row['Address']),
    city: cleanValue(row['City']),
    state: cleanValue(row['State']),
    zipcode: cleanValue(row['Zipcode']),
    
    // Debt information
    debtCategory: debtCategory,
    debtTypes: cleanValue(row['Debt Types']) ? [cleanValue(row['Debt Types'])] : [],
    totalDebtAmount: cleanValue(row['Total Debt Amount']) && !isNaN(row['Total Debt Amount']) 
      ? parseFloat(row['Total Debt Amount']) 
      : undefined,
    numberOfCreditors: cleanValue(row['Number of Creditors']) && !isNaN(row['Number of Creditors'])
      ? parseInt(row['Number of Creditors'])
      : undefined,
    monthlyDebtPayment: cleanValue(row['Monthly Debt Payment']) && !isNaN(row['Monthly Debt Payment'])
      ? parseFloat(row['Monthly Debt Payment'])
      : undefined,
    creditScore: cleanValue(row['Credit Score']) && !isNaN(row['Credit Score'])
      ? parseInt(row['Credit Score'])
      : undefined,
    creditScoreRange: creditScoreRange,
    
    // Lead status and qualification
    category: category,
    status: 'new', // Default status
    qualificationStatus: qualificationStatus,
    leadProgressStatus: cleanValue(row['Lead Progress Status']) || undefined,
    
    // Notes and follow-up
    notes: cleanValue(row['Notes']) || cleanValue(row['Assignment Notes']) || '',
    followUpDate: cleanValue(row['Follow Up Date']) ? parseDate(row['Follow Up Date']) : undefined,
    followUpTime: cleanValue(row['Follow Up Time']),
    followUpNotes: cleanValue(row['Follow Up Notes']),
    
    // Organization and user
    organization: REDDINGTON_ORG_ID,
    createdBy: SYSTEM_USER_ID, // Required field
    
    // Timestamps - use the date from "Assigned At" column
    createdAt: parseDate(row['Assigned At']),
    updatedAt: parseDate(row['Updated Date (Eastern)']) || parseDate(row['Assigned At']),
    
    // Duplicate detection - only set if isDuplicate is true
    isDuplicate: false, // We'll handle duplicates separately
    
    // Admin processing
    adminProcessed: row['Admin Processed'] === 'true' || row['Admin Processed'] === 'TRUE',
    adminProcessedAt: cleanValue(row['Admin Processed At']) ? parseDate(row['Admin Processed At']) : undefined,
    
    // Conversion
    convertedAt: cleanValue(row['Converted At']) ? parseDate(row['Converted At']) : undefined,
    conversionValue: cleanValue(row['Conversion Value']) && !isNaN(row['Conversion Value'])
      ? parseFloat(row['Conversion Value'])
      : undefined,
    
    // Completion percentage
    completionPercentage: cleanValue(row['Completion Percentage']) && !isNaN(row['Completion Percentage'])
      ? parseInt(row['Completion Percentage'])
      : 0
  };
  
  return lead;
}

async function importLeads() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Verify organization exists
    const org = await Organization.findById(REDDINGTON_ORG_ID);
    if (!org) {
      throw new Error(`Organization not found: ${REDDINGTON_ORG_ID}`);
    }
    console.log(`✅ Found organization: ${org.name}`);
    
    // Read CSV file
    const csvPath = path.join(__dirname, '../final format.csv');
    console.log(`📂 Reading CSV from: ${csvPath}`);
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found at: ${csvPath}`);
    }
    
    const leads = [];
    const userAssignments = new Map(); // Store user name to ID mappings
    
    // First pass: Read all CSV rows
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          try {
            // Parse the created date for this lead
            const createdDate = parseDate(row['Created Date (Eastern)']);
            
            leads.push({
              row: row,
              createdDate: createdDate,
              assignedToName: cleanValue(row['Assigned To']),
              assignedByName: cleanValue(row['Assigned By']),
              createdByName: cleanValue(row['Created By']),
              updatedByName: cleanValue(row['Updated By']),
              lastUpdatedByName: cleanValue(row['Last Updated By'])
            });
          } catch (error) {
            console.error('Error processing row:', error);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    console.log(`📊 Found ${leads.length} leads in CSV`);
    
    // Group leads by date for proper lead ID sequence
    const leadsByDate = new Map();
    leads.forEach(leadInfo => {
      const dateKey = leadInfo.createdDate.toISOString().split('T')[0]; // YYYY-MM-DD
      if (!leadsByDate.has(dateKey)) {
        leadsByDate.set(dateKey, []);
      }
      leadsByDate.get(dateKey).push(leadInfo);
    });
    
    console.log(`📅 Leads grouped into ${leadsByDate.size} dates`);
    
    // Get all users from REDDINGTON organization for assignment mapping
    const users = await User.find({ organization: REDDINGTON_ORG_ID });
    console.log(`👥 Found ${users.length} users in REDDINGTON organization`);
    
    // Create user mapping by name
    const userMap = new Map();
    users.forEach(user => {
      const firstName = user.name.split(' ')[0].toLowerCase();
      userMap.set(firstName, user._id);
      userMap.set(user.name.toLowerCase(), user._id);
    });
    
    // Second pass: Process each date group and import
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    // Sort dates to import in chronological order
    const sortedDates = Array.from(leadsByDate.keys()).sort();
    
    for (const dateKey of sortedDates) {
      const dateLeads = leadsByDate.get(dateKey);
      console.log(`\n📅 Processing ${dateLeads.length} leads from ${dateKey}`);
      
      for (let i = 0; i < dateLeads.length; i++) {
        const leadInfo = dateLeads[i];
        const sequenceForDate = i + 1; // Use loop index + 1 for sequence
        
        try {
          // Map CSV to lead object - the function will use "Assigned At" date from the row
          const lead = mapCsvToLead(leadInfo.row, sequenceForDate);
          
          // Map user names to IDs
          if (leadInfo.assignedToName) {
            const userId = userMap.get(leadInfo.assignedToName.toLowerCase());
            if (userId) {
              lead.assignedTo = userId;
            }
          }
          
          if (leadInfo.assignedByName) {
            const userId = userMap.get(leadInfo.assignedByName.toLowerCase());
            if (userId) {
              lead.assignedBy = userId;
            }
          }
          
          if (leadInfo.updatedByName) {
            const userId = userMap.get(leadInfo.updatedByName.toLowerCase());
            if (userId) {
              lead.updatedBy = userId;
            }
          }
          
          if (leadInfo.lastUpdatedByName) {
            lead.lastUpdatedBy = leadInfo.lastUpdatedByName;
          }
          
          // Check if lead already exists by phone or email
          const existingLead = await Lead.findOne({
            organization: REDDINGTON_ORG_ID,
            $or: [
              { phone: lead.phone },
              { email: lead.email }
            ].filter(condition => Object.values(condition)[0]) // Filter out null/undefined
          });
          
          if (existingLead) {
            console.log(`⚠️  Skipping duplicate lead: ${lead.name} (${lead.phone || lead.email})`);
            skipped++;
            continue;
          }
          
          // Create the lead
          await Lead.create(lead);
          imported++;
          
          if (imported % 10 === 0) {
            console.log(`  ✅ Imported ${imported} leads...`);
          }
          
        } catch (error) {
          console.error(`  ❌ Error importing lead ${leadInfo.row['Name']}:`, error.message);
          errors++;
        }
      }
    }
    
    console.log('\n📊 Import Summary:');
    console.log(`✅ Successfully imported: ${imported} leads`);
    console.log(`⚠️  Skipped (duplicates): ${skipped} leads`);
    console.log(`❌ Errors: ${errors} leads`);
    console.log(`📝 Total processed: ${leads.length} leads`);
    
    // Show sample of imported leads
    const sampleLeads = await Lead.find({ organization: REDDINGTON_ORG_ID })
      .sort({ createdAt: -1 })
      .limit(5);
    
    console.log('\n📋 Sample of imported leads:');
    sampleLeads.forEach(lead => {
      console.log(`  - ${lead.leadId}: ${lead.name} (${lead.phone}) - ${lead.qualificationStatus}`);
    });
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run the import
if (require.main === module) {
  importLeads()
    .then(() => {
      console.log('\n🎉 Import completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Import failed:', error);
      process.exit(1);
    });
}

module.exports = importLeads;

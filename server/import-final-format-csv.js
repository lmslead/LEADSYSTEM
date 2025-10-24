const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Lead = require('./models/Lead');
const User = require('./models/User');
const Organization = require('./models/Organization');
require('dotenv').config();

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

// Parse CSV data
function parseCSV(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue; // Skip empty lines
    
    const values = [];
    let currentValue = '';
    let insideQuotes = false;
    
    for (let char of lines[i]) {
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim()); // Push the last value
    
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    data.push(row);
  }
  
  return data;
}

// Parse date from DD-MMM-YY format to Date object
function parseDate(dateStr) {
  if (!dateStr || dateStr === '-') return new Date();
  
  try {
    // Format: "03-Oct-25" -> October 3, 2025
    const parts = dateStr.split('-');
    if (parts.length !== 3) return new Date();
    
    const day = parseInt(parts[0]);
    const monthStr = parts[1];
    const year = 2000 + parseInt(parts[2]); // Convert 25 to 2025
    
    const months = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    
    const month = months[monthStr];
    if (month === undefined) return new Date();
    
    // Create date in EST timezone (UTC-5 or UTC-4 depending on DST)
    const date = new Date(year, month, day, 12, 0, 0); // Set to noon to avoid timezone issues
    return date;
  } catch (error) {
    console.error('Error parsing date:', dateStr, error);
    return new Date();
  }
}

// Clean phone number
function cleanPhone(phone) {
  if (!phone || phone === '-') return '';
  return phone.replace(/[\s\-\(\)]/g, '');
}

// Parse debt amount
function parseDebtAmount(amount) {
  if (!amount || amount === '-' || amount === 'NRF' || amount === 'frozen') return undefined;
  const cleaned = amount.replace(/[,$]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? undefined : parsed;
}

// Map qualification status
function mapQualificationStatus(status) {
  if (!status || status === '-') return 'pending';
  
  const statusLower = status.toLowerCase().trim();
  if (statusLower.includes('qualified') && !statusLower.includes('not')) {
    return 'qualified';
  } else if (statusLower.includes('not qualified')) {
    return 'not-qualified';
  }
  return 'pending';
}

// Map lead progress status
function mapLeadProgressStatus(progressStatus, notes) {
  if (!progressStatus || progressStatus === '-') {
    // Check notes for status
    if (notes) {
      const notesLower = notes.toLowerCase();
      if (notesLower.includes('sold')) return 'SALE';
      if (notesLower.includes('dnc') || notesLower.includes('do not call')) return 'DO NOT CALL';
      if (notesLower.includes('not interested') || notesLower.includes('ni')) return 'Not Interested';
      if (notesLower.includes('callback') || notesLower.includes('cb')) return 'Callback Needed';
      if (notesLower.includes('hang') || notesLower.includes('hu')) return 'Hang-up';
      if (notesLower.includes('aip')) return 'AIP Client';
      if (notesLower.includes('nq')) return 'Not Qualified';
      if (notesLower.includes('affordability')) return 'Affordability';
    }
    return 'Others';
  }
  
  return progressStatus;
}

async function importCSV() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get REDDINGTON GLOBAL CONSULTANCY organization
    const organization = await Organization.findOne({ 
      name: { $regex: /REDDINGTON GLOBAL CONSULTANCY/i } 
    });
    
    if (!organization) {
      console.error('❌ REDDINGTON GLOBAL CONSULTANCY organization not found!');
      process.exit(1);
    }
    
    console.log(`✅ Found organization: ${organization.name} (${organization._id})`);
    console.log(`   Org Prefix: ${organization.orgPrefix}\n`);

    // Get all users from this organization for assignment mapping
    const users = await User.find({ organization: organization._id });
    const userMap = {};
    users.forEach(user => {
      userMap[user.username.toLowerCase()] = user._id;
      // Also map common name variations
      const firstName = user.username.split(' ')[0]?.toLowerCase();
      if (firstName) {
        userMap[firstName] = user._id;
      }
    });
    
    console.log(`✅ Found ${users.length} users in the organization\n`);

    // Parse CSV
    const csvPath = path.join(__dirname, '..', 'final format.csv');
    console.log(`📄 Reading CSV from: ${csvPath}\n`);
    
    const csvData = parseCSV(csvPath);
    console.log(`📊 Found ${csvData.length} leads in CSV\n`);

    // Get current lead count for lead ID generation
    const currentLeadCount = await Lead.countDocuments({ organization: organization._id });
    let leadCounter = currentLeadCount + 1;

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    // Process each lead
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      
      try {
        // Parse creation date from "Assigned At" field
        const createdDate = parseDate(row['Assigned At']);
        
        // Generate Lead ID with the date from CSV
        const year = createdDate.getFullYear().toString().slice(-2);
        const month = String(createdDate.getMonth() + 1).padStart(2, '0');
        const day = String(createdDate.getDate()).padStart(2, '0');
        const sequence = String(leadCounter).padStart(5, '0');
        const leadId = `${organization.orgPrefix}${year}${month}${day}${sequence}`;
        
        // Find assigned user
        const assignedToName = row['Assigned To']?.toLowerCase().trim();
        const createdByName = row['Created By']?.toLowerCase().trim();
        const assignedById = userMap[assignedToName] || userMap[createdByName];
        
        // Parse debt amount
        const totalDebtAmount = parseDebtAmount(row['Total Debt Amount']);
        
        // Map qualification status
        const qualificationStatus = mapQualificationStatus(row['Qualification Status']);
        
        // Map lead progress status
        const leadProgressStatus = mapLeadProgressStatus(
          row['Lead Progress Status'],
          row['Assignment Notes'] || row['Notes']
        );
        
        // Create lead object
        const leadData = {
          leadId: leadId,
          name: row['Name'] || 'Unknown',
          email: row['Email'] && row['Email'] !== '-' ? row['Email'] : undefined,
          phone: cleanPhone(row['Phone']),
          alternatePhone: cleanPhone(row['Alternate Phone']),
          debtCategory: row['Debt Category'] && row['Debt Category'] !== '-' ? row['Debt Category'].toLowerCase() : 'unsecured',
          totalDebtAmount: totalDebtAmount,
          numberOfCreditors: row['Number of Creditors'] && row['Number of Creditors'] !== '-' ? parseInt(row['Number of Creditors']) : undefined,
          monthlyDebtPayment: row['Monthly Debt Payment'] && row['Monthly Debt Payment'] !== '-' ? parseFloat(row['Monthly Debt Payment']) : undefined,
          creditScore: row['Credit Score'] && row['Credit Score'] !== '-' ? parseInt(row['Credit Score']) : undefined,
          creditScoreRange: row['Credit Score Range'] && row['Credit Score Range'] !== '-' ? row['Credit Score Range'] : undefined,
          notes: row['Assignment Notes'] || row['Notes'] || '',
          address: row['Address'] && row['Address'] !== '-' ? row['Address'] : undefined,
          city: row['City'] && row['City'] !== '-' ? row['City'] : undefined,
          state: row['State'] && row['State'] !== '-' ? row['State'] : undefined,
          zipcode: row['Zipcode'] && row['Zipcode'] !== '-' ? row['Zipcode'] : undefined,
          category: row['Category'] && row['Category'] !== '-' ? row['Category'].toLowerCase() : 'cold',
          completionPercentage: row['Completion Percentage'] && row['Completion Percentage'] !== '-' ? parseInt(row['Completion Percentage']) : 0,
          leadProgressStatus: leadProgressStatus,
          qualificationStatus: qualificationStatus,
          lastUpdatedBy: row['Last Updated By'] || row['Updated By'],
          lastUpdatedAt: createdDate,
          organization: organization._id,
          assignedTo: assignedById,
          assignedBy: assignedById,
          assignedAt: createdDate,
          status: qualificationStatus === 'qualified' ? 'follow-up' : 'new',
          createdAt: createdDate,
          updatedAt: createdDate
        };

        // Create and save the lead
        const lead = new Lead(leadData);
        await lead.save();
        
        results.success++;
        leadCounter++;
        
        if ((i + 1) % 10 === 0) {
          console.log(`✅ Imported ${i + 1}/${csvData.length} leads...`);
        }
        
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          name: row['Name'],
          error: error.message
        });
        console.error(`❌ Failed to import lead ${i + 1} (${row['Name']}):`, error.message);
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully imported: ${results.success} leads`);
    console.log(`❌ Failed to import: ${results.failed} leads`);
    console.log(`📈 Total processed: ${csvData.length} leads`);
    
    if (results.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      results.errors.forEach(err => {
        console.log(`   Row ${err.row} (${err.name}): ${err.error}`);
      });
    }
    
    console.log('\n✅ Import completed!');

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
  importCSV()
    .then(() => {
      console.log('\n🎉 CSV import script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 CSV import script failed:', error);
      process.exit(1);
    });
}

module.exports = importCSV;

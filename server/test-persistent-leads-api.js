/**
 * API Test Script: Persistent Leads Feature
 * 
 * This script tests the new API endpoints for the persistent leads feature.
 * Run this after migration to ensure everything is working correctly.
 */

const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = process.env.CLIENT_URL || 'http://localhost:5000';

// Helper function to create axios instance with auth
function createAuthenticatedAxios(token) {
  return axios.create({
    baseURL: `${API_BASE_URL}/api`,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
}

async function testPersistentLeadsAPI() {
  console.log('🧪 Testing Persistent Leads API Endpoints...');
  
  try {
    // Note: You'll need to provide valid JWT tokens for testing
    console.log('⚠️  To run this test, you need to:');
    console.log('1. Get a valid Agent1 JWT token');
    console.log('2. Get a valid Agent2 JWT token');
    console.log('3. Update the tokens in this script');
    console.log('4. Uncomment the test code below');
    
    /*
    // Replace these with actual JWT tokens from your application
    const AGENT1_TOKEN = 'your-agent1-jwt-token-here';
    const AGENT2_TOKEN = 'your-agent2-jwt-token-here';
    
    const agent1Api = createAuthenticatedAxios(AGENT1_TOKEN);
    const agent2Api = createAuthenticatedAxios(AGENT2_TOKEN);
    
    console.log('\n1. Testing Agent2 assigned leads endpoint...');
    const assignedLeadsResponse = await agent2Api.get('/leads/assigned-to-me');
    console.log(`✅ Assigned leads: ${assignedLeadsResponse.data.data.leads.length}`);
    
    // Test with status filters
    const pendingLeadsResponse = await agent2Api.get('/leads/assigned-to-me?status=pending');
    console.log(`📋 Pending qualification leads: ${pendingLeadsResponse.data.data.leads.length}`);
    
    const callbackLeadsResponse = await agent2Api.get('/leads/assigned-to-me?status=callback');
    console.log(`📞 Callback needed leads: ${callbackLeadsResponse.data.data.leads.length}`);
    
    // Test status update endpoints (you'll need a real lead ID)
    console.log('\n2. Testing status update endpoints...');
    console.log('⚠️  Need a real lead ID to test status updates');
    
    // Example (uncomment and provide real lead ID):
    // const testLeadId = 'your-test-lead-id-here';
    // await agent2Api.put(`/leads/${testLeadId}/qualification-status`, {
    //   qualificationStatus: 'qualified',
    //   updatedBy: 'Test Script'
    // });
    // console.log('✅ Qualification status update successful');
    
    // await agent2Api.put(`/leads/${testLeadId}/progress-status`, {
    //   leadProgressStatus: 'SALE',
    //   updatedBy: 'Test Script'
    // });
    // console.log('✅ Progress status update successful');
    
    console.log('\n✅ API tests completed successfully!');
    */
    
    console.log('\n📋 Manual Testing Steps:');
    console.log('1. Login as Agent1 and assign a lead to Agent2');
    console.log('2. Login as Agent2 and check the dashboard tabs');
    console.log('3. Verify leads appear in "Pending Qualification" and "Callback Needed" tabs');
    console.log('4. Update status from Agent2 dashboard and verify leads move/disappear');
    console.log('5. Check that leads persist across browser refreshes');
    
  } catch (error) {
    console.error('❌ API test failed:', error.response?.data || error.message);
  }
}

// Handle script execution
if (require.main === module) {
  testPersistentLeadsAPI()
    .then(() => {
      console.log('✅ API test script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ API test script failed:', error);
      process.exit(1);
    });
}

module.exports = { testPersistentLeadsAPI };
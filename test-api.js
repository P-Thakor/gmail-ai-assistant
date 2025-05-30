// Test script to call the emails API
const fetch = require('node-fetch');

async function testEmailsAPI() {
  try {
    const response = await fetch('http://localhost:3000/api/emails?maxResults=5&q=in:inbox', {
      method: 'GET',
      headers: {
        'Cookie': 'next-auth.session-token=YOUR_SESSION_TOKEN_HERE' // You'll need to get this from browser
      }
    });
    
    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testEmailsAPI();

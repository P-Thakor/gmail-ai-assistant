// Test script for email viewing API endpoints
// Run with: node test-email-api.js

const BASE_URL = 'http://localhost:3000'

async function testEmailEndpoints() {
  console.log('Testing Gmail AI Assistant Email APIs\n')
  
  try {
    // Test 1: List emails
    console.log('1. Testing email list API...')
    const emailsResponse = await fetch(`${BASE_URL}/api/emails?maxResults=5`)
    console.log(`Status: ${emailsResponse.status}`)
    
    if (emailsResponse.ok) {
      const emailsData = await emailsResponse.json()
      console.log(`Found ${emailsData.emails?.length || 0} emails`)
      
      if (emailsData.emails && emailsData.emails.length > 0) {
        const firstEmail = emailsData.emails[0]
        console.log(`First email ID: ${firstEmail.id}`)
        console.log(`Subject: ${firstEmail.subject}`)
        
        // Test 2: Get specific email details
        console.log('\n2. Testing single email API...')
        const emailDetailResponse = await fetch(`${BASE_URL}/api/emails/${firstEmail.id}`)
        console.log(`Status: ${emailDetailResponse.status}`)
        
        if (emailDetailResponse.ok) {
          const emailDetail = await emailDetailResponse.json()
          console.log(`Email subject: ${emailDetail.subject}`)
          console.log(`From: ${emailDetail.from}`)
          console.log(`Body length: ${emailDetail.body?.length || 0} characters`)
          console.log(`Attachments: ${emailDetail.attachments?.length || 0}`)
          console.log(`Thread length: ${emailDetail.threadLength || 1} messages`)
          
          // Test 3: Test email update (mark as read)
          console.log('\n3. Testing email update API...')
          const updateResponse = await fetch(`${BASE_URL}/api/emails/${firstEmail.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ markAsRead: true })
          })
          console.log(`Update status: ${updateResponse.status}`)
          
          if (updateResponse.ok) {
            console.log('Email successfully marked as read')
          } else {
            const error = await updateResponse.json()
            console.log('Update error:', error)
          }
          
        } else {
          const error = await emailDetailResponse.json()
          console.log('Email detail error:', error)
        }
      }
    } else {
      const error = await emailsResponse.json()
      console.log('Emails list error:', error)
    }
    
    // Test 4: Stats API
    console.log('\n4. Testing stats API...')
    const statsResponse = await fetch(`${BASE_URL}/api/stats`)
    console.log(`Stats status: ${statsResponse.status}`)
    
    if (statsResponse.ok) {
      const stats = await statsResponse.json()
      console.log('Stats:', stats)
    } else {
      const error = await statsResponse.json()
      console.log('Stats error:', error)
    }
    
  } catch (error) {
    console.error('Test error:', error.message)
  }
  
  console.log('\nAPI testing completed!')
}

// Check if running directly
if (require.main === module) {
  testEmailEndpoints()
}

module.exports = { testEmailEndpoints }

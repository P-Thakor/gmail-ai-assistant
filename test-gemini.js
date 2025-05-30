// Test script to verify Gemini API integration
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Load environment variables
require('dotenv').config();

async function testGeminiAPI() {
  try {
    console.log('Testing Gemini API integration...');
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
Generate a professional email reply to the following email:

Subject: Meeting Request for Tomorrow
From: john.doe@example.com
Body: Hi, I would like to schedule a 30-minute meeting with you tomorrow at 2 PM to discuss the project proposal. Please let me know if this works for you.

Please generate a positive reply that accepts the meeting request. Format the response as:
Subject: [New Subject]
Body: [Reply content]
`;

    console.log('Sending request to Gemini...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Gemini API Response:');
    console.log(text);
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing Gemini API:', error);
  }
}

testGeminiAPI();

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      tone = 'professional', 
      sentiment = 'positive', 
      customInstructions = '',
      length = 'medium',
      emailContent,
      emailSubject,
      senderName,
      senderEmail
    } = await request.json();

    // Get the Gemini model
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // Create the prompt based on the design patterns
    const prompt = generateReplyPrompt({
      emailContent,
      emailSubject,
      senderName,
      senderEmail,
      tone,
      sentiment,
      customInstructions,
      length
    });

    // Generate the reply
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const generatedReply = response.text();

    // Parse the generated reply to extract subject and body
    const parsedReply = parseGeneratedReply(generatedReply);

    return NextResponse.json({
      success: true,
      reply: parsedReply,
      generationTime: Date.now(),
      settings: {
        tone,
        sentiment,
        length,
        customInstructions
      }
    });

  } catch (error) {
    console.error('Error generating reply:', error);
    return NextResponse.json(
      { error: 'Failed to generate reply' },
      { status: 500 }
    );
  }
}

function generateReplyPrompt({
  emailContent,
  emailSubject,
  senderName,
  senderEmail,
  tone,
  sentiment,
  customInstructions,
  length
}: {
  emailContent: string;
  emailSubject: string;
  senderName: string;
  senderEmail: string;
  tone: string;
  sentiment: string;
  customInstructions: string;
  length: string;
}) {
  const toneInstructions = {
    casual: 'Use a casual, friendly tone with informal language',
    professional: 'Use a professional, business-appropriate tone',
    formal: 'Use a formal, official tone with proper business etiquette'
  };

  const sentimentInstructions = {
    positive: 'Respond positively, agreeing or accepting the request where appropriate',
    neutral: 'Respond neutrally and professionally, providing information or clarification',
    negative: 'Politely decline or express concerns about the request'
  };

  const lengthInstructions = {
    short: 'Keep the response brief and to the point (2-3 sentences)',
    medium: 'Provide a balanced response with appropriate detail (1-2 paragraphs)',
    detailed: 'Provide a comprehensive response with full details and explanations'
  };

  return `You are an AI assistant helping to generate professional email replies. Please create a response to the following email:

FROM: ${senderName} (${senderEmail})
SUBJECT: ${emailSubject}

EMAIL CONTENT:
${emailContent}

REPLY REQUIREMENTS:
- Tone: ${toneInstructions[tone as keyof typeof toneInstructions]}
- Sentiment: ${sentimentInstructions[sentiment as keyof typeof sentimentInstructions]}
- Length: ${lengthInstructions[length as keyof typeof lengthInstructions]}
${customInstructions ? `- Additional Instructions: ${customInstructions}` : ''}

Please format your response as follows:
SUBJECT: [Reply subject line starting with "Re: "]
BODY:
[The email body content]

Make sure the reply:
1. Addresses the main points from the original email
2. Maintains the requested tone and sentiment
3. Includes appropriate greetings and closing
4. Is contextually relevant and helpful
5. Follows professional email etiquette`;
}

function parseGeneratedReply(generatedReply: string) {
  const lines = generatedReply.split('\n');
  let subject = '';
  let body = '';
  let isBody = false;

  for (const line of lines) {
    if (line.startsWith('SUBJECT:')) {
      subject = line.replace('SUBJECT:', '').trim();
    } else if (line.startsWith('BODY:')) {
      isBody = true;
    } else if (isBody && line.trim()) {
      body += line + '\n';
    }
  }

  // Fallback parsing if the format isn't followed exactly
  if (!subject && !body) {
    const parts = generatedReply.split('\n\n');
    if (parts.length >= 2) {
      subject = `Re: ${parts[0].replace('Re: ', '').trim()}`;
      body = parts.slice(1).join('\n\n');
    } else {
      subject = 'Re: Your Email';
      body = generatedReply;
    }
  }

  return {
    subject: subject || 'Re: Your Email',
    body: body.trim() || generatedReply.trim()
  };
}

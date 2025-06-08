import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { gmail_v1, google } from 'googleapis';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }    const { subject, body, to, threadId } = await request.json();

    console.log('Send reply request data:', { 
      to, 
      subject: subject?.substring(0, 50) + '...', 
      bodyLength: body?.length,
      threadId 
    });

    // Validate required fields
    if (!to || !subject || !body) {
      return NextResponse.json({ 
        error: 'Missing required fields: to, subject, or body' 
      }, { status: 400 });
    }

    // Initialize Gmail API
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: session.accessToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });    // Create the email message
    const emailContent = createEmailMessage({
      to,
      subject,
      body,
      threadId
    });

    console.log('Generated email content (first 200 chars):', 
      Buffer.from(emailContent, 'base64').toString('utf8').substring(0, 200) + '...'
    );

    // Send the reply
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: emailContent,
        threadId: threadId
      }
    });

    return NextResponse.json({
      success: true,
      messageId: response.data.id,
      threadId: response.data.threadId
    });
  } catch (error) {
    console.error('Error sending reply:', error);
    
    // Handle specific authentication errors
    if (error && typeof error === 'object') {
      const errorObj = error as any;
      
      // Handle invalid_grant error (expired/revoked refresh token)
      const isInvalidGrant = 
        errorObj.message === 'invalid_grant' || 
        errorObj.error === 'invalid_grant' ||
        errorObj.response?.error === 'invalid_grant' ||
        errorObj.response?.data?.error === 'invalid_grant' ||
        (errorObj.message && errorObj.message.includes('invalid_grant')) ||
        (errorObj.response?.data?.error_description && 
         errorObj.response.data.error_description.includes('expired or revoked'));
      
      if (isInvalidGrant) {
        console.log('Detected invalid_grant error in send reply API, returning AUTH_EXPIRED');
        return NextResponse.json({ 
          error: 'Authentication expired. Please sign in again.',
          code: 'AUTH_EXPIRED'
        }, { status: 401 })
      }
      
      // Handle other auth errors
      if (errorObj.code === 401 || errorObj.code === 403 || errorObj.status === 401 || errorObj.status === 403) {
        return NextResponse.json({ 
          error: 'Authentication failed. Please re-authenticate.',
          code: 'AUTH_FAILED'
        }, { status: 401 })
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to send reply' },
      { status: 500 }
    );
  }
}

function createEmailMessage({
  to,
  subject,
  body,
  threadId
}: {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
}) {
  // Create proper RFC 2822 email format
  const messageParts = [
    'MIME-Version: 1.0',
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 7bit'
  ];

  // Add thread references for replies
  if (threadId) {
    messageParts.push(`In-Reply-To: <${threadId}>`);
    messageParts.push(`References: <${threadId}>`);
  }

  // Add empty line to separate headers from body
  messageParts.push('');
  
  // Add the HTML body
  messageParts.push(body.replace(/\n/g, '<br>'));

  const message = messageParts.join('\r\n');
  
  // Convert to base64url format (Gmail API requirement)
  return Buffer.from(message, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

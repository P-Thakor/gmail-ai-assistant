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
    }

    const { subject, body, to, threadId } = await request.json();

    // Initialize Gmail API
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: session.accessToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Create the email message
    const emailContent = createEmailMessage({
      to,
      subject,
      body,
      threadId
    });

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
  const messageParts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    threadId ? `In-Reply-To: ${threadId}` : '',
    threadId ? `References: ${threadId}` : '',
    'Content-Type: text/html; charset=utf-8',
    '',
    body.replace(/\n/g, '<br>')
  ].filter(Boolean);

  const message = messageParts.join('\r\n');
  return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

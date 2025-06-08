import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from "@/lib/auth"
import { PrismaClient } from '@/generated/prisma'
import { google } from 'googleapis'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id, attachmentId } = await params
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
      console.log('Downloading attachment:', { emailId: id, attachmentId });
    
    // Check if session has access token (from NextAuth JWT)
    if (!session.accessToken) {
      return NextResponse.json({ error: 'No access token in session' }, { status: 401 })
    }

    // Get user's account info from database for refresh token
    const account = await prisma.account.findFirst({
      where: {
        user: {
          email: session.user.email
        },
        provider: 'google'
      }
    })

    if (!account?.refresh_token) {
      return NextResponse.json({ error: 'No Gmail refresh token found' }, { status: 401 })
    }

    // Initialize Gmail API with fresh token from session
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXTAUTH_URL + '/api/auth/callback/google'
    )
    
    // Use the fresh access token from session, not from database
    auth.setCredentials({
      access_token: session.accessToken,
      refresh_token: account.refresh_token
    })

    const gmail = google.gmail({ version: 'v1', auth })

    // Get the attachment
    const attachment = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: id,
      id: attachmentId
    })

    if (!attachment.data.data) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Decode the base64 data
    const attachmentData = Buffer.from(attachment.data.data, 'base64')

    // Get the original email to find attachment info
    const emailDetail = await gmail.users.messages.get({
      userId: 'me',
      id: id,
      format: 'full'
    })

    // Find the attachment info to get filename and mime type
    let filename = 'attachment'
    let mimeType = 'application/octet-stream'

    const findAttachment = (payload: any): void => {
      if (payload.body?.attachmentId === attachmentId) {
        filename = payload.filename || 'attachment'
        mimeType = payload.mimeType || 'application/octet-stream'
        return
      }
      
      if (payload.parts) {
        payload.parts.forEach((part: any) => findAttachment(part))
      }
    }

    if (emailDetail.data.payload) {
      findAttachment(emailDetail.data.payload)
    }

    // Return the file
    return new NextResponse(attachmentData, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': attachmentData.length.toString(),
      },
    })
  } catch (error) {
    console.error('Attachment download error:', error)
    
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
        console.log('Detected invalid_grant error in attachment download API, returning AUTH_EXPIRED');
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
    
    return NextResponse.json({ 
      error: 'Failed to download attachment',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

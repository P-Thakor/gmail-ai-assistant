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
    
    // Get user's access token from database
    const account = await prisma.account.findFirst({
      where: {
        user: {
          email: session.user.email
        },
        provider: 'google'
      }
    })

    if (!account?.access_token) {
      return NextResponse.json({ error: 'No Gmail access token found' }, { status: 401 })
    }

    // Initialize Gmail API
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXTAUTH_URL + '/api/auth/callback/google'
    )
    
    auth.setCredentials({
      access_token: account.access_token,
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
    
    return NextResponse.json({ 
      error: 'Failed to download attachment',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

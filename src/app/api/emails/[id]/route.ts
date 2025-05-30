import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from "@/lib/auth"
import { PrismaClient } from '@/generated/prisma'
import { google } from 'googleapis'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('Fetching email details for ID:', id);
    
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

    // Initialize Gmail API with token refresh capability
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXTAUTH_URL + '/api/auth/callback/google'
    )
    
    auth.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token
    })

    // Set up automatic token refresh
    auth.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await prisma.account.update({
          where: { id: account.id },
          data: { 
            access_token: tokens.access_token,
            expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : null
          }
        })
      }
    })

    const gmail = google.gmail({ version: 'v1', auth })

    // Fetch the specific email from Gmail
    const emailDetail = await gmail.users.messages.get({
      userId: 'me',
      id: id,
      format: 'full'
    })

    if (!emailDetail.data) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 })
    }

    const headers = emailDetail.data.payload?.headers || []
    const getHeader = (name: string) => 
      headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || ''

    // Extract email body with better parsing
    let body = ''
    let htmlBody = ''
    
    const extractContentFromPayload = (payload: any): { text: string, html: string } => {
      let textContent = ''
      let htmlContent = ''
      
      if (payload.body?.data) {
        if (payload.mimeType === 'text/plain') {
          textContent = Buffer.from(payload.body.data, 'base64').toString('utf-8')
        } else if (payload.mimeType === 'text/html') {
          htmlContent = Buffer.from(payload.body.data, 'base64').toString('utf-8')
        }
      }
      
      if (payload.parts) {
        for (const part of payload.parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            textContent = Buffer.from(part.body.data, 'base64').toString('utf-8')
          } else if (part.mimeType === 'text/html' && part.body?.data) {
            htmlContent = Buffer.from(part.body.data, 'base64').toString('utf-8')
          } else if (part.parts) {
            // Handle nested parts (multipart/alternative, etc.)
            const nestedContent = extractContentFromPayload(part)
            if (!textContent && nestedContent.text) textContent = nestedContent.text
            if (!htmlContent && nestedContent.html) htmlContent = nestedContent.html
          }
        }
      }
      
      return { text: textContent, html: htmlContent }
    }

    const { text, html } = extractContentFromPayload(emailDetail.data.payload)
    body = text
    htmlBody = html

    // If no plain text, convert HTML to text as fallback
    if (!body && htmlBody) {
      body = htmlBody.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    }

    // Extract attachments information
    const attachments: Array<{
      filename: string
      mimeType: string
      size: number
      attachmentId: string
    }> = []

    const extractAttachments = (payload: any) => {
      if (payload.filename && payload.body?.attachmentId) {
        attachments.push({
          filename: payload.filename,
          mimeType: payload.mimeType || 'application/octet-stream',
          size: payload.body.size || 0,
          attachmentId: payload.body.attachmentId
        })
      }
      
      if (payload.parts) {
        payload.parts.forEach((part: any) => extractAttachments(part))
      }
    }

    if (emailDetail.data.payload) {
      extractAttachments(emailDetail.data.payload)
    }

    // Get additional email metadata
    const threadInfo = emailDetail.data.threadId ? await gmail.users.threads.get({
      userId: 'me',
      id: emailDetail.data.threadId
    }) : null

    const email = {
      id: emailDetail.data.id!,
      gmailId: emailDetail.data.id!,
      threadId: emailDetail.data.threadId!,
      subject: getHeader('Subject'),
      from: getHeader('From'),
      to: getHeader('To'),
      cc: getHeader('Cc'),
      bcc: getHeader('Bcc'),
      replyTo: getHeader('Reply-To'),
      body: body,
      htmlBody: htmlBody,
      snippet: emailDetail.data.snippet || '',
      isRead: !emailDetail.data.labelIds?.includes('UNREAD'),
      isImportant: emailDetail.data.labelIds?.includes('IMPORTANT') || false,
      isStarred: emailDetail.data.labelIds?.includes('STARRED') || false,
      receivedAt: new Date(parseInt(emailDetail.data.internalDate!) || Date.now()),
      labels: emailDetail.data.labelIds || [],
      attachments: attachments,
      threadLength: threadInfo?.data.messages?.length || 1,
      messageId: getHeader('Message-ID'),
      references: getHeader('References'),
      inReplyTo: getHeader('In-Reply-To')
    }

    return NextResponse.json(email)

  } catch (error) {
    console.error('Gmail API Error:', error)
    
    // Log more details about the error
    if (error && typeof error === 'object') {
      console.error('Error details:', {
        message: (error as any).message,
        code: (error as any).code,
        status: (error as any).status,
        response: (error as any).response?.data
      })
    }
    
    // Handle authentication errors
    if (error && typeof error === 'object' && 'code' in error && (error.code === 401 || error.code === 403)) {
      return NextResponse.json({ error: 'Authentication failed. Please re-authenticate.' }, { status: 401 })
    }

    return NextResponse.json({ 
      error: 'Failed to fetch email details',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// PATCH endpoint to update email status (mark as read, star, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    const body = await request.json()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('Updating email status for ID:', id, 'Updates:', body);
    
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

    // Handle different update operations
    if (body.markAsRead !== undefined) {
      const labelsToAdd = body.markAsRead ? [] : ['UNREAD']
      const labelsToRemove = body.markAsRead ? ['UNREAD'] : []
      
      await gmail.users.messages.modify({
        userId: 'me',
        id: id,
        requestBody: {
          addLabelIds: labelsToAdd,
          removeLabelIds: labelsToRemove
        }
      })
    }

    if (body.star !== undefined) {
      const labelsToAdd = body.star ? ['STARRED'] : []
      const labelsToRemove = body.star ? [] : ['STARRED']
      
      await gmail.users.messages.modify({
        userId: 'me',
        id: id,
        requestBody: {
          addLabelIds: labelsToAdd,
          removeLabelIds: labelsToRemove
        }
      })
    }

    if (body.archive !== undefined && body.archive) {
      await gmail.users.messages.modify({
        userId: 'me',
        id: id,
        requestBody: {
          removeLabelIds: ['INBOX']
        }
      })
    }

    if (body.delete !== undefined && body.delete) {
      await gmail.users.messages.trash({
        userId: 'me',
        id: id
      })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Gmail API Error:', error)
    
    return NextResponse.json({ 
      error: 'Failed to update email',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

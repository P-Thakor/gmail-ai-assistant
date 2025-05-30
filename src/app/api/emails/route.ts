import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from "@/lib/auth"
import { PrismaClient } from '@/generated/prisma'
import { google } from 'googleapis'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('Session:', session.user.email);
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
    console.log('Account found:', account.id);

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
        })      }
    })

    const gmail = google.gmail({ version: 'v1', auth })

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const maxResults = parseInt(searchParams.get('maxResults') || '10')
    const q = searchParams.get('q') || 'in:inbox'
    
    console.log('Gmail API request params:', { maxResults, q });

    // Fetch emails from Gmail
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      q
    })

    if (!response.data.messages) {
      return NextResponse.json({ emails: [], totalCount: 0 })
    }

    // Fetch detailed information for each email
    const emailDetails = await Promise.all(
      response.data.messages.map(async (message) => {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'full'
        })

        const headers = detail.data.payload?.headers || []
        const getHeader = (name: string) => 
          headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || ''

        // Extract email body
        let body = ''
        const extractTextFromPayload = (payload: any): string => {
          if (payload.body?.data) {
            return Buffer.from(payload.body.data, 'base64').toString('utf-8')
          }
          if (payload.parts) {
            for (const part of payload.parts) {
              if (part.mimeType === 'text/plain' && part.body?.data) {
                return Buffer.from(part.body.data, 'base64').toString('utf-8')
              }
              if (part.mimeType === 'text/html' && part.body?.data) {
                const htmlContent = Buffer.from(part.body.data, 'base64').toString('utf-8')
                // Basic HTML to text conversion (you might want to use a proper library)
                return htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
              }
            }
          }
          return ''
        }

        body = extractTextFromPayload(detail.data.payload)

        const email = {
          id: detail.data.id!,
          gmailId: detail.data.id!,
          threadId: detail.data.threadId!,
          subject: getHeader('Subject'),
          from: getHeader('From'),
          to: getHeader('To'),
          body: body.substring(0, 5000), // Limit body length
          snippet: detail.data.snippet || '',
          isRead: !detail.data.labelIds?.includes('UNREAD'),
          isImportant: detail.data.labelIds?.includes('IMPORTANT') || false,
          receivedAt: new Date(parseInt(detail.data.internalDate!) || Date.now()),
          labels: detail.data.labelIds || []
        }

        return email
      })
    )

    // Calculate stats
    const stats = {
      unreadCount: emailDetails.filter(email => !email.isRead).length,
      importantCount: emailDetails.filter(email => email.isImportant).length,
      totalCount: response.data.resultSizeEstimate || 0
    }

    return NextResponse.json({ 
      emails: emailDetails,
      stats,
      totalCount: stats.totalCount
    })
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
    
    // Handle token refresh if needed
    if (error && typeof error === 'object' && 'code' in error && (error.code === 401 || error.code === 403)) {
      return NextResponse.json({ error: 'Authentication failed. Please re-authenticate.' }, { status: 401 })
    }

    return NextResponse.json({ 
      error: 'Failed to fetch emails',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
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
    console.log('Account found:', account.id);

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
    })  } catch (error) {
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
    
    // Handle specific authentication errors
    if (error && typeof error === 'object') {
      const errorObj = error as any;
      
      // Handle invalid_grant error (expired/revoked refresh token)
      // Check multiple possible locations where the error might be
      const isInvalidGrant = 
        errorObj.message === 'invalid_grant' || 
        errorObj.error === 'invalid_grant' ||
        errorObj.response?.error === 'invalid_grant' ||
        errorObj.response?.data?.error === 'invalid_grant' ||
        (errorObj.message && errorObj.message.includes('invalid_grant')) ||
        (errorObj.response?.data?.error_description && 
         errorObj.response.data.error_description.includes('expired or revoked'));
      
      if (isInvalidGrant) {
        console.log('Detected invalid_grant error, returning AUTH_EXPIRED');
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
      error: 'Failed to fetch emails',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
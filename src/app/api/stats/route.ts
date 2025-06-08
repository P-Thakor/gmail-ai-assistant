import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get stats from database
    const [
      totalRepliesGenerated,
      repliesSent,
      emailsStored
    ] = await Promise.all([
      prisma.generatedReply.count({
        where: { userId: user.id }
      }),
      prisma.generatedReply.count({
        where: { 
          userId: user.id,
          status: 'SENT'
        }
      }),
      prisma.email.count({
        where: { userId: user.id }
      })
    ])

    // Calculate estimated time saved (assuming 3 minutes per reply)
    const timeSavedMinutes = repliesSent * 3
    const timeSavedHours = (timeSavedMinutes / 60).toFixed(1)

    const stats = {
      totalRepliesGenerated,
      repliesSent,
      emailsStored,
      timeSavedHours: parseFloat(timeSavedHours)
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Stats API Error:', error)
    
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
        console.log('Detected invalid_grant error in stats API, returning AUTH_EXPIRED');
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
      error: 'Failed to fetch stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
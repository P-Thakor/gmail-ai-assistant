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
    return NextResponse.json({ 
      error: 'Failed to fetch stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
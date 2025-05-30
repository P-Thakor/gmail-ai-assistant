"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { 
  ArrowLeft,
  Reply,
  ReplyAll,
  Forward,
  Archive,
  Trash2,
  Star,
  Bot,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Wand2
} from "lucide-react"

interface GmailEmail {
  id: string
  gmailId: string
  threadId: string
  subject: string
  from: string
  to: string
  cc?: string
  bcc?: string
  replyTo?: string
  body: string
  htmlBody?: string
  snippet: string
  isRead: boolean
  isImportant: boolean
  isStarred: boolean
  receivedAt: string
  labels: string[]
  attachments?: Array<{
    filename: string
    mimeType: string
    size: number
    attachmentId: string
  }>
  threadLength?: number
  messageId?: string
  references?: string
  inReplyTo?: string
}

interface EmailDetailPageProps {
  emailId: string
}

export default function EmailDetailPage({ emailId }: EmailDetailPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const [email, setEmail] = useState<GmailEmail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFullContent, setShowFullContent] = useState(false)
  const [showHtmlContent, setShowHtmlContent] = useState(false)

  const initialAction = searchParams?.get('action')
  useEffect(() => {
    fetchEmail()
  }, [emailId])

  const fetchEmail = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/emails/${emailId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch email')
      }
      
      const emailData = await response.json()
      setEmail(emailData)
      
      // Mark as read if not already
      if (!emailData.isRead) {
        markAsRead(emailData.id)
      }
    } catch (err) {
      console.error('Error fetching email:', err)
      setError('Failed to load email')
    } finally {
      setLoading(false)
    }
  }
  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/emails/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAsRead: true })
      })
      
      // Update local state
      if (email) {
        setEmail({ ...email, isRead: true })
      }
    } catch (err) {
      console.error('Error marking as read:', err)
    }
  }

  const toggleStar = async () => {
    if (!email) return
    
    try {
      await fetch(`/api/emails/${email.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ star: !email.isStarred })
      })
      
      // Update local state
      setEmail({ ...email, isStarred: !email.isStarred })
    } catch (err) {
      console.error('Error toggling star:', err)
    }
  }

  const archiveEmail = async () => {
    if (!email) return
    
    try {
      await fetch(`/api/emails/${email.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archive: true })
      })
      
      // Navigate back to dashboard
      router.push('/')
    } catch (err) {
      console.error('Error archiving email:', err)
    }  }

  const formatEmailAddress = (address: string) => {
    if (!address) return ''
    
    // Handle "Name <email@domain.com>" format
    const nameEmailMatch = address.match(/^(.*?)\s*<(.+)>$/)
    if (nameEmailMatch) {
      const name = nameEmailMatch[1]?.trim()
      const email = nameEmailMatch[2]?.trim()
      return name ? `${name} <${email}>` : email
    }
    
    return address
  }

  const getDisplayContent = () => {
    if (!email) return ''
    
    if (showHtmlContent && email.htmlBody) {
      return email.htmlBody
    }
    
    if (showFullContent) {
      return email.body
    }
    
    // Show truncated content (first 500 characters)
    return email.body.length > 500 ? email.body.substring(0, 500) + '...' : email.body
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }


  const getAvatarFromEmail = (fromEmail: string) => {
    if (!fromEmail) return 'UN'
    
    const nameEmailMatch = fromEmail.match(/^(.*?)\s*<(.+)>$/)
    if (nameEmailMatch) {
      const name = nameEmailMatch[1]?.trim()
      if (name && name.length > 0) {
        const nameParts = name.split(' ').filter(part => part.length > 0)
        if (nameParts.length >= 2) {
          return (nameParts[0][0] + nameParts[1][0]).toUpperCase()
        }
        return name.substring(0, 2).toUpperCase()
      }
      const email = nameEmailMatch[2]
      return email.substring(0, 2).toUpperCase()
    }
    
    if (fromEmail.includes('@')) {
      const emailPart = fromEmail.split('@')[0]
      return emailPart.substring(0, 2).toUpperCase()
    }
    
    return fromEmail.substring(0, 2).toUpperCase() || 'UN'
  }

  const getSenderName = (fromEmail: string) => {
    if (!fromEmail) return 'Unknown'
    
    const nameEmailMatch = fromEmail.match(/^(.*?)\s*<(.+)>$/)
    if (nameEmailMatch) {
      const name = nameEmailMatch[1]?.trim()
      if (name && name.length > 0) {
        return name
      }
      const email = nameEmailMatch[2]
      return email.split('@')[0]
    }
    
    if (fromEmail.includes('@')) {
      return fromEmail.split('@')[0]
    }
    
    return fromEmail || 'Unknown'
  }

  const getSenderEmail = (fromEmail: string) => {
    const nameEmailMatch = fromEmail.match(/^(.*?)\s*<(.+)>$/)
    if (nameEmailMatch) {
      return nameEmailMatch[2]
    }
    return fromEmail
  }

  const getAvatarColor = (fromEmail: string) => {
    const colors = [
      'bg-blue-500',
      'bg-purple-500', 
      'bg-green-500',
      'bg-red-500',
      'bg-yellow-500',
      'bg-indigo-500',
      'bg-pink-500',
      'bg-teal-500'
    ]
    
    if (!fromEmail) return colors[0]
    
    let hash = 0
    for (let i = 0; i < fromEmail.length; i++) {
      const char = fromEmail.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    
    return colors[Math.abs(hash) % colors.length]
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading email...</p>
        </div>
      </div>
    )
  }

  if (error || !email) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl">!</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Email Not Found</h2>
          <p className="text-gray-600 mb-4">{error || 'The email you\'re looking for doesn\'t exist.'}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/')}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-lg font-semibold text-gray-900">Email Details</h1>
            </div>
            
            <div className="flex items-center space-x-2">
              <button className="p-2 text-gray-500 hover:text-gray-700 transition-colors">
                <Star className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-500 hover:text-gray-700 transition-colors">
                <Archive className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-500 hover:text-gray-700 transition-colors">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Email Content */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              {/* Email Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-start space-x-4">
                  <div className={`w-12 h-12 ${getAvatarColor(email.from)} rounded-full flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white font-medium">{getAvatarFromEmail(email.from)}</span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">{getSenderName(email.from)}</h2>
                        <p className="text-sm text-gray-600">{getSenderEmail(email.from)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">{formatDate(email.receivedAt)}</p>
                        {!email.isRead && (
                          <span className="inline-block mt-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                            Unread
                          </span>
                        )}
                      </div>
                    </div>
                      <div className="mt-2">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">To:</span> {formatEmailAddress(email.to)}
                      </p>
                      {email.cc && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">CC:</span> {formatEmailAddress(email.cc)}
                        </p>
                      )}
                      {email.bcc && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">BCC:</span> {formatEmailAddress(email.bcc)}
                        </p>
                      )}
                      {email.threadLength && email.threadLength > 1 && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Thread:</span> {email.threadLength} messages
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="mt-4">
                  <h1 className="text-xl font-bold text-gray-900">{email.subject || '(No Subject)'}</h1>
                </div>
              </div>              {/* Email Body */}
              <div className="p-6">
                {/* Content View Options */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setShowFullContent(!showFullContent)}
                      className="text-sm text-blue-600 hover:text-blue-700 underline"
                    >
                      {showFullContent ? 'Show Less' : 'View Full Email'}
                    </button>
                    {email.htmlBody && (
                      <button
                        onClick={() => setShowHtmlContent(!showHtmlContent)}
                        className="text-sm text-gray-600 hover:text-gray-700 underline"
                      >
                        {showHtmlContent ? 'Plain Text' : 'Rich Text'}
                      </button>
                    )}
                  </div>
                  
                  {/* Email Actions */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={toggleStar}
                      className={`p-2 rounded-lg transition-colors ${
                        email.isStarred 
                          ? 'text-yellow-500 hover:text-yellow-600 bg-yellow-50' 
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                      }`}
                      title={email.isStarred ? 'Remove star' : 'Add star'}
                    >
                      <Star className={`w-4 h-4 ${email.isStarred ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      onClick={archiveEmail}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                      title="Archive email"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Attachments */}
                {email.attachments && email.attachments.length > 0 && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">
                      Attachments ({email.attachments.length})
                    </h3>
                    <div className="space-y-2">
                      {email.attachments.map((attachment, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-white rounded border"
                        >
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                              <span className="text-blue-600 text-xs font-medium">
                                {attachment.filename.split('.').pop()?.toUpperCase() || 'FILE'}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{attachment.filename}</p>
                              <p className="text-xs text-gray-500">{formatFileSize(attachment.size)}</p>
                            </div>
                          </div>                          <button 
                            onClick={() => {
                              window.open(`/api/emails/${email.id}/attachments/${attachment.attachmentId}`, '_blank')
                            }}
                            className="text-sm text-blue-600 hover:text-blue-700 px-3 py-1 rounded border border-blue-200 hover:border-blue-300 transition-colors"
                          >
                            Download
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Email Content */}
                <div className="prose max-w-none">
                  {showHtmlContent && email.htmlBody ? (
                    <div 
                      className="text-gray-800 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: email.htmlBody }}
                    />
                  ) : (
                    <div className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {getDisplayContent()}
                    </div>
                  )}
                </div>

                {/* Show more content button */}
                {!showFullContent && email.body.length > 500 && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => setShowFullContent(true)}
                      className="text-blue-600 hover:text-blue-700 text-sm underline"
                    >
                      Show full content ({email.body.length - 500} more characters)
                    </button>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="p-6 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center space-x-3">
                  <button className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                    <Reply className="w-4 h-4" />
                    <span>Reply</span>
                  </button>
                  <button className="flex items-center space-x-2 text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <ReplyAll className="w-4 h-4" />
                    <span>Reply All</span>
                  </button>
                  <button className="flex items-center space-x-2 text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <Forward className="w-4 h-4" />
                    <span>Forward</span>
                  </button>
                </div>
              </div>
            </div>
          </div>          {/* AI Reply Assistant */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 sticky top-24">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                    <Bot className="text-white w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Quick Reply Options</h3>
                </div>
                <p className="text-sm text-gray-600 mt-2">Generate AI-powered replies</p>
              </div>

              <div className="p-6">
                {/* Quick Reply Options - Matching Design */}
                <div className="space-y-3 mb-6">
                  <button 
                    onClick={() => router.push(`/reply/${emailId}?type=positive`)}
                    className="w-full bg-green-50 border border-green-200 rounded-lg p-4 text-left hover:bg-green-100 transition-colors group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                        <ThumbsUp className="text-white w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium text-green-800">Positive Reply</p>
                        <p className="text-sm text-green-600">Accept, agree, or confirm</p>
                      </div>
                    </div>
                  </button>

                  <button 
                    onClick={() => router.push(`/reply/${emailId}?type=negative`)}
                    className="w-full bg-red-50 border border-red-200 rounded-lg p-4 text-left hover:bg-red-100 transition-colors group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                        <ThumbsDown className="text-white w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium text-red-800">Negative Reply</p>
                        <p className="text-sm text-red-600">Decline, reject, or postpone</p>
                      </div>
                    </div>
                  </button>

                  <button 
                    onClick={() => router.push(`/reply/${emailId}?type=neutral`)}
                    className="w-full bg-blue-50 border border-blue-200 rounded-lg p-4 text-left hover:bg-blue-100 transition-colors group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                        <Wand2 className="text-white w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium text-blue-800">Custom Reply</p>
                        <p className="text-sm text-blue-600">Write specific instructions</p>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Additional Actions */}
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm font-medium text-gray-900 mb-3">Other Actions</p>
                  <div className="space-y-2">
                    <button 
                      onClick={toggleStar}
                      className="w-full text-left text-sm text-gray-600 hover:text-gray-900 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors flex items-center"
                    >
                      <Star className="w-4 h-4 mr-2" />
                      {email.isStarred ? 'Remove Star' : 'Mark as Important'}
                    </button>
                    <button 
                      onClick={archiveEmail}
                      className="w-full text-left text-sm text-gray-600 hover:text-gray-900 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors flex items-center"
                    >
                      <Archive className="w-4 h-4 mr-2" />
                      Archive Email
                    </button>
                    <button 
                      onClick={() => {/* Forward functionality */}}
                      className="w-full text-left text-sm text-gray-600 hover:text-gray-900 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors flex items-center"
                    >
                      <Forward className="w-4 h-4 mr-2" />
                      Forward
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
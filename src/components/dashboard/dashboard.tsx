"use client"

import { useState, useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { 
  Mail, 
  RefreshCw, 
  Bot, 
  Send, 
  Clock, 
  Star,
  Archive,
  Forward,
  ThumbsUp,
  ThumbsDown,
  Eye,
  Filter,
  User,
  AlertCircle,
  Loader2,
  Reply
} from "lucide-react"
import EmailPreviewModal from "../email/EmailPreviewModal"

interface GmailEmail {
  id: string
  gmailId: string
  threadId: string
  subject: string
  from: string
  to: string
  body: string
  snippet: string
  isRead: boolean
  isImportant: boolean
  receivedAt: string
  labels: string[]
}

interface EmailStats {
  unreadCount: number
  importantCount: number
  totalCount: number
}

interface AppStats {
  totalRepliesGenerated: number
  repliesSent: number
  emailsStored: number
  timeSavedHours: number
}

export default function Dashboard() {
  const { data: session } = useSession()
  const router = useRouter()
  const [emails, setEmails] = useState<GmailEmail[]>([])
  const [emailStats, setEmailStats] = useState<EmailStats>({ unreadCount: 0, importantCount: 0, totalCount: 0 })
  const [appStats, setAppStats] = useState<AppStats>({ totalRepliesGenerated: 0, repliesSent: 0, emailsStored: 0, timeSavedHours: 0 })
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedEmail, setSelectedEmail] = useState<GmailEmail | null>(null)
  const [previewModalOpen, setPreviewModalOpen] = useState(false)  // Handle refresh token errors by signing out and redirecting to login
  useEffect(() => {
    if (session?.error === 'RefreshAccessTokenError') {
      console.log('Refresh token error detected, signing out user');
      signOut({ callbackUrl: '/' });
    }
  }, [session]);
  const fetchEmails = async (showLoading = true) => {
    try {
      // Don't make API calls if we don't have a valid session
      if (!session?.user || session?.error) {
        console.log('No valid session available, skipping email fetch');
        return;
      }

      if (showLoading) setLoading(true)
      setSyncing(!showLoading)
      setError(null)

      const queryParams = new URLSearchParams({
        maxResults: '20',
        q: filter === 'unread' ? 'in:inbox is:unread' : 
           filter === 'important' ? 'in:inbox is:important' : 'in:inbox'
      })

      const response = await fetch(`/api/emails?${queryParams}`)
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json()
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          errorData = { error: 'Failed to fetch emails', code: 'UNKNOWN_ERROR' };
        }
        
        // Handle authentication expiration
        if (response.status === 401 || errorData.code === 'AUTH_EXPIRED') {
          console.log('Authentication expired (401 or AUTH_EXPIRED), signing out user');
          signOut({ callbackUrl: '/' });
          return;
        }
        
        throw new Error(errorData.error || 'Failed to fetch emails')
      }

      const data = await response.json()
      setEmails(data.emails)
      setEmailStats(data.stats)
    } catch (err) {
      console.error('Error fetching emails:', err)
      
      // Check if this is a network error that might indicate auth issues
      if (err instanceof TypeError && err.message.includes('fetch')) {
        console.log('Network error detected, possibly due to auth issues');
        setError('Network error - please check your connection and try signing in again');      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch emails')
      }
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }

  const fetchStats = async () => {
    try {
      // Don't make API calls if we don't have a valid session
      if (!session?.user || session?.error) {
        console.log('No valid session available, skipping stats fetch');
        return;
      }

      const response = await fetch('/api/stats')
      if (response.ok) {
        const stats = await response.json()
        setAppStats(stats)
      } else {
        let errorData;
        try {
          errorData = await response.json()
        } catch (parseError) {
          console.error('Failed to parse stats error response:', parseError);
          errorData = { error: 'Failed to fetch stats', code: 'UNKNOWN_ERROR' };
        }
        
        // Handle authentication expiration
        if (response.status === 401 || errorData.code === 'AUTH_EXPIRED') {
          console.log('Authentication expired while fetching stats (401 or AUTH_EXPIRED), signing out user');
          signOut({ callbackUrl: '/' });
          return;
        }
        
        console.error('Failed to fetch stats:', errorData);
      }
    } catch (err) {
      console.error('Error fetching stats:', err)
      
      // Check if this is a network error that might indicate auth issues
      if (err instanceof TypeError && err.message.includes('fetch')) {
        console.log('Network error in stats fetch, possibly due to auth issues');      }
    }
  }

  useEffect(() => {
    // Only fetch data if we have a valid session without errors
    if (session?.user && !session?.error) {
      fetchEmails()
      fetchStats()
    }
  }, [session, filter])

  const handleSync = () => {
    fetchEmails(false)
    fetchStats()
  }

  const handleEmailClick = (email: GmailEmail) => {
    setSelectedEmail(email)
    setPreviewModalOpen(true)
  }

  const handleQuickReply = (email: GmailEmail, type: 'positive' | 'negative') => {
    router.push(`/email/${email.id}?action=reply&tone=${type === 'positive' ? 'friendly' : 'professional'}`)
  }

  const handleEmailUpdate = (emailId: string, updates: Partial<GmailEmail>) => {
    setEmails(prevEmails => 
      prevEmails.map(email => 
        email.id === emailId ? { ...email, ...updates } : email
      )
    )
    
    // Update stats if read status changed
    if ('isRead' in updates) {
      setEmailStats(prev => ({
        ...prev,
        unreadCount: updates.isRead ? prev.unreadCount - 1 : prev.unreadCount + 1
      }))
    }
  }

  const getStatusBadge = (email: GmailEmail) => {
    if (!email.isRead) {
      return <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">Unread</span>
    }
    if (email.isImportant) {
      return <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">Important</span>
    }
    return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Read</span>
  }

  const getAvatarFromEmail = (fromEmail: string) => {
    if (!fromEmail) return 'UN'
    
    // Handle "Name <email@domain.com>" format
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
      // If no name, use email
      const email = nameEmailMatch[2]
      return email.substring(0, 2).toUpperCase()
    }
    
    // Handle plain email format
    if (fromEmail.includes('@')) {
      const emailPart = fromEmail.split('@')[0]
      return emailPart.substring(0, 2).toUpperCase()
    }
    
    // Fallback for any other format
    return fromEmail.substring(0, 2).toUpperCase() || 'UN'
  }

  const getSenderName = (fromEmail: string) => {
    if (!fromEmail) return 'Unknown'
    
    // Handle "Name <email@domain.com>" format
    const nameEmailMatch = fromEmail.match(/^(.*?)\s*<(.+)>$/)
    if (nameEmailMatch) {
      const name = nameEmailMatch[1]?.trim()
      if (name && name.length > 0) {
        return name
      }
      // If no name, use email username
      const email = nameEmailMatch[2]
      return email.split('@')[0]
    }
    
    // Handle plain email format
    if (fromEmail.includes('@')) {
      return fromEmail.split('@')[0]
    }
    
    // Fallback
    return fromEmail || 'Unknown'
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
    
    // Create a simple hash from the email string
    let hash = 0
    for (let i = 0; i < fromEmail.length; i++) {
      const char = fromEmail.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    
    return colors[Math.abs(hash) % colors.length]
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 1) {
      return `${Math.floor(diffInHours * 60)} min ago`
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`
    } else {
      return `${Math.floor(diffInHours / 24)} days ago`
    }
  }

  if (loading && emails.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading your Gmail data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Mail className="text-white w-4 h-4" />
              </div>
              <span className="font-semibold text-gray-900">Gmail AI Assistant</span>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={handleSync}
                disabled={syncing}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
              </button>
              <div className="flex items-center space-x-2">
                {session?.user?.image ? (
                  <img 
                    src={session.user.image} 
                    alt="Profile" 
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                )}
                <span className="text-sm text-gray-700">{session?.user?.name || 'User'}</span>
                <button
                  onClick={() => signOut()}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors ml-2"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Manage your emails with AI-powered replies</p>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={handleSync}
              disabled={syncing}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:transform-none"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Sync Inbox'}</span>
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error loading emails</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <button 
                onClick={() => fetchEmails()}
                className="text-sm text-red-800 underline mt-2 hover:text-red-900"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 transform hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Unread Emails</p>
                <p className="text-2xl font-bold text-gray-900">{emailStats.unreadCount}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Mail className="text-blue-600 w-6 h-6" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 transform hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">AI Replies Generated</p>
                <p className="text-2xl font-bold text-gray-900">{appStats.totalRepliesGenerated}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Bot className="text-green-600 w-6 h-6" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 transform hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Emails Sent</p>
                <p className="text-2xl font-bold text-gray-900">{appStats.repliesSent}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Send className="text-purple-600 w-6 h-6" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 transform hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Time Saved</p>
                <p className="text-2xl font-bold text-gray-900">{appStats.timeSavedHours}h</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="text-orange-600 w-6 h-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Email List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Emails</h2>
              <div className="flex items-center space-x-2">
                <select 
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All emails</option>
                  <option value="unread">Unread only</option>
                  <option value="important">Important</option>
                </select>
                <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                  <Filter className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          
          <div className="divide-y divide-gray-200">
            {emails.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No emails found</p>
              </div>
            ) : (
              emails.map((email) => (
                <div key={email.id} className="p-6 hover:bg-gray-50 cursor-pointer transition-colors group">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className={`w-10 h-10 ${getAvatarColor(email.from)} rounded-full flex items-center justify-center`}>
                        <span className="text-white font-medium text-sm">{getAvatarFromEmail(email.from)}</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0" onClick={() => handleEmailClick(email)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium text-gray-900">{getSenderName(email.from)}</p>
                          {getStatusBadge(email)}
                        </div>
                        <p className="text-sm text-gray-500">{formatTime(email.receivedAt)}</p>
                      </div>
                      <p className="text-sm text-gray-900 font-medium mt-1">{email.subject || '(No Subject)'}</p>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{email.snippet}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center space-x-2">
                      {!email.isRead && (
                        <>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleQuickReply(email, 'positive')
                            }}
                            className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full hover:bg-green-200 transition-colors flex items-center space-x-1"
                          >
                            <ThumbsUp className="w-3 h-3" />
                            <span>Positive Reply</span>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleQuickReply(email, 'negative')
                            }}
                            className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full hover:bg-red-200 transition-colors flex items-center space-x-1"
                          >
                            <ThumbsDown className="w-3 h-3" />
                            <span>Professional Reply</span>
                          </button>
                        </>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEmailClick(email)
                        }}
                        className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full hover:bg-blue-200 transition-colors flex items-center space-x-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Preview</span>
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/email/${email.id}`)
                        }}
                        className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full hover:bg-gray-200 transition-colors flex items-center space-x-1"
                      >
                        <Mail className="w-3 h-3" />
                        <span>View Full</span>
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/email/${email.id}?action=reply`)
                        }}
                        className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full hover:bg-purple-200 transition-colors flex items-center space-x-1"
                      >
                        <Reply className="w-3 h-3" />
                        <span>AI Reply</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Email Preview Modal */}
      <EmailPreviewModal
        email={selectedEmail}
        isOpen={previewModalOpen}
        onClose={() => {
          setPreviewModalOpen(false)
          setSelectedEmail(null)
        }}
        onEmailUpdate={handleEmailUpdate}
      />
    </div>
  )
}
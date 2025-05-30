import { useState } from "react"
import { 
  X, 
  Reply, 
  Forward, 
  Archive, 
  Trash2, 
  Star, 
//   MarkAsRead,
  ExternalLink,
  Clock,
  User
} from "lucide-react"
import { useRouter } from "next/navigation"

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

interface EmailPreviewModalProps {
  email: GmailEmail | null
  isOpen: boolean
  onClose: () => void
  onEmailUpdate?: (emailId: string, updates: Partial<GmailEmail>) => void
}

export default function EmailPreviewModal({ 
  email, 
  isOpen, 
  onClose, 
  onEmailUpdate 
}: EmailPreviewModalProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  if (!isOpen || !email) return null

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
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleReplyClick = () => {
    router.push(`/email/${email.id}?action=reply`)
    onClose()
  }

  const handleViewFullEmail = () => {
    router.push(`/email/${email.id}`)
    onClose()
  }

  const handleMarkAsRead = async () => {
    if (loading) return
    
    setLoading(true)
    try {
      const response = await fetch(`/api/emails/${email.id}/mark-read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: !email.isRead })
      })
      
      if (response.ok) {
        onEmailUpdate?.(email.id, { isRead: !email.isRead })
      }
    } catch (err) {
      console.error('Error updating email:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 ${getAvatarColor(email.from)} rounded-full flex items-center justify-center`}>
                <span className="text-white font-medium text-sm">{getAvatarFromEmail(email.from)}</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{getSenderName(email.from)}</h3>
                <p className="text-sm text-gray-600">{getSenderEmail(email.from)}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={handleViewFullEmail}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                title="View full email"
              >
                <ExternalLink className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Email Details */}
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {email.subject || '(No Subject)'}
            </h2>
            
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <Clock className="w-4 h-4" />
                <span>{formatDate(email.receivedAt)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <User className="w-4 h-4" />
                <span>To: {email.to}</span>
              </div>
              {!email.isRead && (
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                  Unread
                </span>
              )}
            </div>
          </div>

          {/* Email Body */}
          <div className="p-6 max-h-96 overflow-y-auto">
            <div className="prose max-w-none">
              {email.body ? (
                <div 
                  className="text-gray-800 leading-relaxed whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: email.body }}
                />
              ) : (
                <p className="text-gray-800 leading-relaxed">{email.snippet}</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center space-x-2">
              <button
                onClick={handleMarkAsRead}
                disabled={loading}
                className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                {/* <MarkAsRead className="w-4 h-4" /> */}
                <span>{email.isRead ? 'Mark Unread' : 'Mark Read'}</span>
              </button>
              
              <button className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
                <Star className="w-4 h-4" />
                <span>Star</span>
              </button>
              
              <button className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
                <Archive className="w-4 h-4" />
                <span>Archive</span>
              </button>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleViewFullEmail}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                View Full Email
              </button>
              
              <button
                onClick={handleReplyClick}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Reply className="w-4 h-4" />
                <span>Reply with AI</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
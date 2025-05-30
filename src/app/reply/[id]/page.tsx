'use client';

import { useEffect, useState, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface EmailData {
  id: string;
  subject: string;
  body: string;
  from: {
    name: string;
    email: string;
  };
  threadId?: string;
}

interface GeneratedReply {
  subject: string;
  body: string;
}

interface ReplySettings {
  tone: 'casual' | 'professional' | 'formal';
  sentiment: 'positive' | 'neutral' | 'negative';
  length: 'short' | 'medium' | 'detailed';
  customInstructions: string;
}

export default function ReplyGenerationPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailId = resolvedParams.id;
  const replyType = searchParams.get('type') || 'positive';

  const [email, setEmail] = useState<EmailData | null>(null);
  const [generatedReply, setGeneratedReply] = useState<GeneratedReply | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [generationTime, setGenerationTime] = useState<number | null>(null);
  const [settings, setSettings] = useState<ReplySettings>({
    tone: 'professional',
    sentiment: replyType as 'positive' | 'neutral' | 'negative',
    length: 'medium',
    customInstructions: ''
  });

  useEffect(() => {
    fetchEmailData();
    generateInitialReply();
  }, [emailId, replyType]);

  const fetchEmailData = async () => {
    try {
      const response = await fetch(`/api/emails/${emailId}`);
      if (response.ok) {
        const data = await response.json();
        setEmail(data);
      }
    } catch (error) {
      console.error('Error fetching email:', error);
    }
  };

  const generateInitialReply = async () => {
    await generateReply();
  };

  const generateReply = async () => {
    if (!email) return;

    setIsGenerating(true);
    const startTime = Date.now();

    try {
      const response = await fetch(`/api/emails/${emailId}/generate-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailContent: email.body,
          emailSubject: email.subject,
          senderName: email.from.name,
          senderEmail: email.from.email,
          ...settings
        })
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedReply(data.reply);
        setGenerationTime((Date.now() - startTime) / 1000);
      }
    } catch (error) {
      console.error('Error generating reply:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const sendReply = async () => {
    if (!generatedReply || !email) return;

    setIsSending(true);
    try {
      const response = await fetch(`/api/emails/${emailId}/send-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: generatedReply.subject,
          body: generatedReply.body,
          to: email.from.email,
          threadId: email.threadId
        })
      });

      if (response.ok) {
        router.push(`/email/${emailId}?sent=true`);
      }
    } catch (error) {
      console.error('Error sending reply:', error);
    } finally {
      setIsSending(false);
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-100 text-green-800';
      case 'negative': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'fas fa-thumbs-up';
      case 'negative': return 'fas fa-thumbs-down';
      default: return 'fas fa-minus';
    }
  };

  if (!email) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading email...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 text-gray-600 mb-4">
            <button 
              onClick={() => router.back()}
              className="hover:text-gray-900 transition-colors"
            >
              <i className="fas fa-arrow-left mr-2"></i>Back
            </button>
            <span>→</span>
            <span>Reply to {email.from.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">AI Reply Generation</h1>
          <p className="text-gray-600 mt-1">Review and customize your AI-generated reply</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Generated Reply */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              {/* Reply Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Generated Reply</h2>
                    <p className="text-sm text-gray-600">Based on {settings.sentiment} response pattern</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getSentimentColor(settings.sentiment)}>
                      <i className={`${getSentimentIcon(settings.sentiment)} mr-1`}></i>
                      {settings.sentiment.charAt(0).toUpperCase() + settings.sentiment.slice(1)}
                    </Badge>
                    <button 
                      onClick={generateReply}
                      disabled={isGenerating}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <i className={`fas fa-redo text-sm ${isGenerating ? 'animate-spin' : ''}`}></i>
                    </button>
                  </div>
                </div>
              </div>

              {/* Reply Content */}
              <div className="p-6">
                {isGenerating ? (
                  <div className="text-center py-12">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Generating your reply...</p>
                  </div>
                ) : generatedReply ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                      <Input 
                        value={generatedReply.subject}
                        onChange={(e) => setGeneratedReply({
                          ...generatedReply,
                          subject: e.target.value
                        })}
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Reply Content</label>
                      <Textarea 
                        rows={12}
                        value={generatedReply.body}
                        onChange={(e) => setGeneratedReply({
                          ...generatedReply,
                          body: e.target.value
                        })}
                        className="w-full"
                        placeholder="Your reply will appear here..."
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500">Click regenerate to create a reply</p>
                  </div>
                )}

                {/* Action Buttons */}
                {generatedReply && (
                  <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                    <div className="flex items-center space-x-4">
                      <Button 
                        onClick={sendReply}
                        disabled={isSending}
                        className="bg-blue-600 text-white hover:bg-blue-700"
                      >
                        <i className="fas fa-paper-plane mr-2"></i>
                        {isSending ? 'Sending...' : 'Send Reply'}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => {/* Save draft functionality */}}
                      >
                        <i className="fas fa-save mr-2"></i>
                        Save Draft
                      </Button>
                      <Button 
                        variant="ghost"
                        onClick={generateReply}
                        disabled={isGenerating}
                      >
                        <i className="fas fa-redo mr-2"></i>
                        Regenerate
                      </Button>
                    </div>
                    {generationTime && (
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <i className="fas fa-clock"></i>
                        <span>Generated in {generationTime.toFixed(1)}s</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Original Email Context */}
            <div className="bg-gray-50 rounded-xl p-6 mt-6 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Original Email Context</h3>
              <div className="text-sm text-gray-600 space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="font-medium">From:</span>
                  <span>{email.from.name} ({email.from.email})</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium">Subject:</span>
                  <span>{email.subject}</span>
                </div>
                <div className="mt-3">
                  <span className="font-medium">Summary:</span>
                  <p className="mt-1">{email.body.substring(0, 200)}...</p>
                </div>
              </div>
            </div>
          </div>

          {/* Generation Settings Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Reply Settings</h3>
              
              {/* Tone Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">Response Tone</label>
                <div className="space-y-2">
                  {(['casual', 'professional', 'formal'] as const).map((tone) => (
                    <label key={tone} className="flex items-center">
                      <input 
                        type="radio" 
                        name="tone" 
                        value={tone}
                        checked={settings.tone === tone}
                        onChange={(e) => setSettings({...settings, tone: e.target.value as any})}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 capitalize">{tone}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sentiment Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">Response Sentiment</label>
                <div className="space-y-2">
                  {(['positive', 'neutral', 'negative'] as const).map((sentiment) => (
                    <label key={sentiment} className="flex items-center">
                      <input 
                        type="radio" 
                        name="sentiment" 
                        value={sentiment}
                        checked={settings.sentiment === sentiment}
                        onChange={(e) => setSettings({...settings, sentiment: e.target.value as any})}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 capitalize">{sentiment}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Custom Instructions */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Custom Instructions</label>
                <Textarea 
                  rows={3}
                  placeholder="Add specific points to include or mention..."
                  value={settings.customInstructions}
                  onChange={(e) => setSettings({...settings, customInstructions: e.target.value})}
                  className="w-full text-sm"
                />
              </div>

              {/* Length Preference */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">Reply Length</label>
                <select 
                  value={settings.length}
                  onChange={(e) => setSettings({...settings, length: e.target.value as any})}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="short">Short & Concise</option>
                  <option value="medium">Medium Detail</option>
                  <option value="detailed">Detailed & Comprehensive</option>
                </select>
              </div>

              {/* Regenerate Button */}
              <Button 
                onClick={generateReply}
                disabled={isGenerating}
                className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 shadow-lg hover:shadow-xl"
              >
                <i className="fas fa-magic mr-2"></i>
                {isGenerating ? 'Generating...' : 'Regenerate Reply'}
              </Button>

              {/* AI Stats */}
              {generationTime && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-900 mb-3">Generation Stats</p>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Generation Time:</span>
                      <span>{generationTime.toFixed(1)}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Model:</span>
                      <span>Gemini Pro</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tone:</span>
                      <span className="capitalize">{settings.tone}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Markdown from 'react-markdown';
import { Button } from '@/components/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { sessionsAPI } from '@/lib/api';
import { PromptInputBox } from '@/components/ui/ai-prompt-box';
import { ChevronLeft, Upload, FileText, MessageSquare } from 'lucide-react';

interface Session {
  id: number;
  name: string;
  current_summary: string | null;
  created_at: string;
}

interface Document {
  id: number;
  filename: string;
  upload_timestamp: string;
}

interface ChatMessage {
  id: number;
  role: string;
  content: string;
  timestamp: string;
}

type PaneView = 'all' | 'docs' | 'chat' | 'summary';

export default function SessionPage({ params }: { params: { id: string } }) {
  const sessionId = parseInt(params.id);
  const [session, setSession] = useState<Session | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [paneView, setPaneView] = useState<PaneView>('all');
  const [docsWidth, setDocsWidth] = useState(256); // 16rem = 256px
  const [summaryWidth, setSummaryWidth] = useState(320); // 20rem = 320px
  const [isResizing, setIsResizing] = useState<'docs' | 'summary' | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const previousMessageCountRef = useRef(0);

  useEffect(() => {
    fetchSessionData();
    const interval = setInterval(fetchSessionData, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Only auto-scroll if user is near bottom and there's a new message
    if (messages.length > previousMessageCountRef.current && shouldAutoScrollRef.current) {
      scrollToBottom();
    }
    previousMessageCountRef.current = messages.length;
  }, [messages]);

  // Track if user is scrolled to bottom
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    shouldAutoScrollRef.current = isNearBottom;
  };

  const fetchSessionData = async () => {
    try {
      const [sessionRes, docsRes, messagesRes] = await Promise.all([
        sessionsAPI.get(sessionId),
        sessionsAPI.getDocuments(sessionId),
        sessionsAPI.getMessages(sessionId),
      ]);

      setSession(sessionRes.data);
      setDocuments(docsRes.data);
      setMessages(messagesRes.data);
    } catch (error) {
      console.error('Failed to fetch session data:', error);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await sessionsAPI.uploadFile(sessionId, file);
      await fetchSessionData();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;
    setChatLoading(true);
    
    // Enable auto-scroll for new messages sent by user
    shouldAutoScrollRef.current = true;

    const tempUserMsg: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    const loadingMsg: ChatMessage = {
      id: Date.now() + 1,
      role: 'assistant',
      content: '__LOADING__',
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg, loadingMsg]);

    try {
      const response = await sessionsAPI.chat(sessionId, message);
      console.log('[OK] Chat response received:', response.data);
      await fetchSessionData();
    } catch (error) {
      console.error('[!] Chat failed:', error);
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id && m.id !== loadingMsg.id));
      alert('Failed to send message. Please try again.');
    } finally {
      setChatLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const togglePane = (view: PaneView) => {
    setPaneView((prev) => (prev === view ? 'all' : view));
  };

  const showDocs = paneView === 'all' || paneView === 'docs';
  const showChat = paneView === 'all' || paneView === 'chat';
  const showSummary = paneView === 'all' || paneView === 'summary';

  const startResize = (pane: 'docs' | 'summary') => {
    setIsResizing(pane);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      if (isResizing === 'docs') {
        const newWidth = Math.max(200, Math.min(600, e.clientX - 16));
        setDocsWidth(newWidth);
      } else if (isResizing === 'summary') {
        const newWidth = Math.max(200, Math.min(600, window.innerWidth - e.clientX - 16));
        setSummaryWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(null);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  if (loading || !session) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-950">
        <p className="text-white/70">Loading session...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-neutral-950">
      {/* Header */}
      <div className="bg-neutral-900 border-b border-neutral-800 px-3 sm:px-4 md:px-6 py-3 sm:py-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="p-1 sm:p-2 h-auto text-white hover:text-purple-400">
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </Button>
          </Link>
          <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-white truncate flex-1">{session.name}</h1>
        </div>
      </div>

      {/* Pane Controls */}
      <div className="bg-neutral-900 border-b border-neutral-800 px-3 sm:px-4 md:px-6 py-2 flex items-center gap-1 sm:gap-2 overflow-x-auto">
        <span className="text-xs sm:text-sm text-white/70 mr-1 sm:mr-2 whitespace-nowrap hidden md:inline">Layout:</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPaneView('all')}
          className={`text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 ${paneView === 'all' ? 'bg-purple-600 text-white' : 'text-white/70 hover:text-white hover:bg-neutral-800'}`}
        >
          <span className="w-3 h-3 sm:w-4 sm:h-4 mr-1">▦</span> <span className="hidden lg:inline">All</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => togglePane('docs')}
          className={`text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 ${paneView === 'docs' ? 'bg-purple-600 text-white' : 'text-white/70 hover:text-white hover:bg-neutral-800'}`}
        >
          <span className="w-3 h-3 sm:w-4 sm:h-4 mr-1">▌</span> Docs
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => togglePane('chat')}
          className={`text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 ${paneView === 'chat' ? 'bg-purple-600 text-white' : 'text-white/70 hover:text-white hover:bg-neutral-800'}`}
        >
          <span className="w-3 h-3 sm:w-4 sm:h-4 mr-1">▤</span> Chat
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => togglePane('summary')}
          className={`text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 ${paneView === 'summary' ? 'bg-purple-600 text-white' : 'text-white/70 hover:text-white hover:bg-neutral-800'}`}
        >
          <span className="w-3 h-3 sm:w-4 sm:h-4 mr-1">▧</span> <span className="hidden lg:inline">Summary</span>
        </Button>
      </div>

      {/* Main Content - Three Pane Layout */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden p-2 sm:p-3 md:p-4 gap-2 sm:gap-3 lg:gap-0">
        {/* Left Pane - Documents */}
        {showDocs && (
          <>
            <div
              className="flex flex-col w-full lg:w-auto"
              style={{ width: paneView === 'docs' ? '100%' : paneView === 'all' && window.innerWidth >= 1024 ? `${docsWidth}px` : '100%' }}
            >
              <Card className="h-full flex flex-col bg-neutral-900 border-neutral-800 min-h-[300px] lg:min-h-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2 text-white">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto px-3 sm:px-4">
              <div className="space-y-2 sm:space-y-3 mb-4">
                {documents.length === 0 ? (
                  <p className="text-xs sm:text-sm text-white/60 italic">No documents uploaded</p>
                ) : (
                  documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-2.5 sm:p-3 bg-neutral-800 rounded-md border border-neutral-700 hover:border-purple-500/50 transition"
                    >
                      <p className="text-xs sm:text-sm font-medium text-white truncate">
                        {doc.filename}
                      </p>
                      <p className="text-[10px] sm:text-xs text-white/60 mt-0.5 sm:mt-1">
                        {formatDate(doc.upload_timestamp)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
            <div className="p-3 sm:p-4 border-t border-neutral-800">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                size="sm"
                className="w-full flex gap-1.5 sm:gap-2 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm py-2 sm:py-2.5"
              >
                <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {uploading ? 'Uploading...' : 'Upload PDF'}
              </Button>
            </div>
          </Card>
        </div>
        {paneView === 'all' && showChat && (
          <div
            className="hidden lg:block w-1 bg-neutral-700 hover:bg-purple-600 cursor-col-resize flex-shrink-0 mx-2"
            onMouseDown={() => startResize('docs')}
            title="Drag to resize"
          />
        )}
        </>
        )}

        {/* Center Pane - Chat */}
        {showChat && (
          <div className="flex-1 flex flex-col w-full lg:w-auto">
            <Card className="h-full flex flex-col bg-neutral-900 border-neutral-800 min-h-[400px] lg:min-h-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2 text-white">
                <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                Chat
              </CardTitle>
            </CardHeader>
            <CardContent 
              ref={chatContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto space-y-3 sm:space-y-4 mb-3 sm:mb-4 pr-2 sm:pr-4 px-3 sm:px-4"
            >
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-white/60 px-4">
                  <p className="text-sm sm:text-base text-center">Start chatting to ask questions about your documents</p>
                </div>
              ) : (
                <div className="space-y-4 sm:space-y-6 flex-1 overflow-y-auto">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role === 'user' ? (
                        <div className="max-w-[85%] sm:max-w-xs lg:max-w-md px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-transparent border border-purple-500 text-white">
                          <Markdown className="text-xs sm:text-sm prose prose-sm max-w-none prose-invert prose-headings:text-white prose-p:text-white prose-li:text-white prose-strong:text-white">
                            {msg.content}
                          </Markdown>
                          <p className="text-[10px] sm:text-xs mt-1 opacity-70">
                            {formatDate(msg.timestamp)}
                          </p>
                        </div>
                      ) : (
                        <div className="w-full text-white pr-4 sm:pr-8 lg:pr-16">
                          {msg.content === '__LOADING__' ? (
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              <div className="flex gap-0.5 sm:gap-1">
                                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                              </div>
                              <p className="text-xs sm:text-sm text-white/70">Analyzing...</p>
                            </div>
                          ) : (
                            <>
                              <Markdown className="text-xs sm:text-sm prose prose-sm max-w-none prose-invert prose-headings:text-white prose-p:text-white prose-li:text-white prose-strong:text-white prose-code:text-purple-400">
                                {msg.content}
                              </Markdown>
                              <p className="text-[10px] sm:text-xs mt-1.5 sm:mt-2 opacity-50">
                                {formatDate(msg.timestamp)}
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div ref={messagesEndRef} />
            </CardContent>
            <div className="p-3 sm:p-4 border-t border-neutral-800 space-y-1.5 sm:space-y-2">
              <PromptInputBox
                isLoading={chatLoading}
                onSend={(message) => handleSendMessage(message)}
                placeholder={documents.length === 0 ? 'Upload a PDF to start chatting...' : 'Ask a question about the documents...'}
                disabled={documents.length === 0 || chatLoading}
              />
              {documents.length === 0 && (
                <p className="text-[10px] sm:text-xs text-white/60">Upload a PDF to enable chat and voice input for this session.</p>
              )}
            </div>
          </Card>
        </div>
        )}

        {/* Right Pane - Summary */}
        {showSummary && (
          <>
            {paneView === 'all' && showChat && (
              <div
                className="hidden lg:block w-1 bg-neutral-700 hover:bg-purple-600 cursor-col-resize flex-shrink-0 mx-2"
                onMouseDown={() => startResize('summary')}
                title="Drag to resize"
              />
            )}
            <div
              className="flex flex-col w-full lg:w-auto"
              style={{ width: paneView === 'summary' ? '100%' : paneView === 'all' && window.innerWidth >= 1024 ? `${summaryWidth}px` : '100%' }}
            >
              <Card className="h-full flex flex-col overflow-hidden bg-neutral-900 border-neutral-800 min-h-[300px] lg:min-h-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg text-white">Summary</CardTitle>
              <p className="text-[10px] sm:text-xs text-white/60 mt-1.5 sm:mt-2">
                Updates automatically as you upload documents
              </p>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto prose prose-sm max-w-none prose-invert px-3 sm:px-4">
              {session.current_summary ? (
                <Markdown className="text-xs sm:text-sm text-white">
                  {session.current_summary}
                </Markdown>
              ) : (
                <p className="text-xs sm:text-sm text-white/60 italic">
                  No summary yet. Upload documents to generate one.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

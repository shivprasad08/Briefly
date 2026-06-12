"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Notebook, store, Source, ChatMessage } from '@/lib/store';
import { extractTextFromPdf } from '@/lib/pdf-extractor';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Settings, User, Plus, FileText, Upload, Send, Paperclip, Globe, Sliders, Mic, File, Info, Trash2, CheckSquare, Search } from 'lucide-react';

export default function NotebookDetail({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    const n = store.getNotebook(params.id);
    if (!n) {
      router.push('/');
    } else {
      setNotebook(n);
    }
  }, [params.id, router]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [notebook?.chatHistory]);

  const updateNotebookState = (updates: Partial<Notebook>) => {
    if (!notebook) return;
    const updated = store.updateNotebook(notebook.id, updates);
    if (updated) setNotebook(updated);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files.length) return;
    const file = e.target.files[0];
    if (file.type !== 'application/pdf') {
      alert("Only PDF files are currently supported in this demo.");
      return;
    }

    try {
      // 1. Extract Text
      const extractedText = await extractTextFromPdf(file);
      
      const newSource: Source = {
        id: uuidv4(),
        name: file.name,
        type: 'pdf',
        content: extractedText
      };

      const updatedSources = [...(notebook?.sources || []), newSource];
      updateNotebookState({ sources: updatedSources });
      
      // 2. Generate Summary if first source
      if (updatedSources.length === 1 && !notebook?.summary) {
        generateSummary(updatedSources);
      }
    } catch (error) {
      console.error("Failed to extract PDF", error);
      alert("Failed to parse PDF.");
    }
    
    // reset input
    e.target.value = '';
  };

  const generateSummary = async (sources: Source[]) => {
    setIsSummarizing(true);
    try {
      let combinedContext = sources.map(s => `Document: ${s.name}\n\n${s.content}`).join('\n\n---\n\n');
      
      // Enforce a strict character limit to prevent 413 Payload Too Large errors from Next.js server
      // and Context Length Exceeded errors from the LLM. 8,000 chars is roughly ~2,000 tokens.
      if (combinedContext.length > 8000) {
        combinedContext = combinedContext.slice(0, 8000) + "\n\n[...TRUNCATED DUE TO LENGTH...]";
      }
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          system: "Generate a detailed structured summary of the uploaded document with headers and bullet points.",
          messages: [{ role: 'user', content: `<documents>\n${combinedContext}\n</documents>\n\nPlease provide a structured markdown summary of these documents.` }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const summaryText = data.content?.[0]?.text || "No summary generated.";
        updateNotebookState({ summary: summaryText });
      } else {
        const err = await response.json();
        console.error("Summary error:", err);
        updateNotebookState({ summary: `Error generating summary: ${err.error}` });
      }
    } catch (error) {
      console.error("Error generating summary:", error);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !notebook) return;
    const activeSources = notebook.sources;
    if (activeSources.length === 0) return;

    const newMessage: ChatMessage = {
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date().toISOString()
    };

    const updatedHistory = [...notebook.chatHistory, newMessage];
    updateNotebookState({ chatHistory: updatedHistory });
    setChatInput('');
    setIsGenerating(true);

    try {
      let combinedContext = activeSources.map(s => `Document: ${s.name}\n\n${s.content}`).join('\n\n---\n\n');
      if (combinedContext.length > 8000) {
        combinedContext = combinedContext.slice(0, 8000) + "\n\n[...TRUNCATED DUE TO LENGTH...]";
      }
      
      const apiMessages = updatedHistory.map(m => ({
        role: m.role,
        content: m.content
      }));

      // Inject context into the last user message
      const lastMsgIndex = apiMessages.length - 1;
      apiMessages[lastMsgIndex].content = `<documents>\n${combinedContext}\n</documents>\n\n${apiMessages[lastMsgIndex].content}`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          system: "You are a helpful assistant analyzing user documents. Base your answers ONLY on the provided <documents>. If the answer is not in the documents, say so.",
          messages: apiMessages
        })
      });

      if (response.ok) {
        const data = await response.json();
        const aiMsg: ChatMessage = {
          role: 'assistant',
          content: data.content?.[0]?.text || "No response.",
          timestamp: new Date().toISOString()
        };
        updateNotebookState({ 
          chatHistory: [...updatedHistory, aiMsg],
          summary: aiMsg.content // Pipe chat responses into the Studio Note reactively
        });
      } else {
        const err = await response.json();
        updateNotebookState({ chatHistory: [...updatedHistory, { role: 'assistant', content: `Error: ${err.error}`, timestamp: new Date().toISOString() }] });
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteSource = (id: string) => {
    if (!notebook) return;
    const filtered = notebook.sources.filter(s => s.id !== id);
    updateNotebookState({ sources: filtered });
  };

  if (!isMounted || !notebook) return <div className="min-h-screen bg-[#1a1a2e]" />;

  return (
    <div className="flex flex-col h-screen bg-[#1a1a2e] text-neutral-300 overflow-hidden font-sans">
      {/* Top Navbar */}
      <header className="flex-none h-14 border-b border-white/10 flex items-center justify-between px-4 bg-[#1a1a2e] z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="p-1.5 hover:bg-white/10 rounded-md transition-colors mr-2">
            <ArrowLeft className="w-5 h-5 text-neutral-400 hover:text-white" />
          </button>
          <div className="text-xl flex items-center justify-center">
            {notebook.icon}
          </div>
          <h1 className="text-sm font-semibold tracking-tight text-white/90 truncate max-w-xs cursor-text hover:bg-white/5 px-2 py-1 rounded">
            {notebook.title}
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="hidden sm:flex items-center gap-2 text-xs font-semibold px-3 py-1.5 border border-white/20 rounded-full hover:bg-white/10 transition-colors text-white/90">
            <Plus className="w-3.5 h-3.5" />
            Create notebook
          </button>
          <button className="text-xs font-medium text-neutral-400 hover:text-white transition-colors">Analytics</button>
          <button className="text-xs font-medium text-neutral-400 hover:text-white transition-colors">Share</button>
          <button className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-neutral-400">
            <Settings className="w-4 h-4" />
          </button>
          <div className="w-7 h-7 bg-white/10 rounded-full flex items-center justify-center border border-white/20 ml-2">
            <User className="w-3.5 h-3.5" />
          </div>
        </div>
      </header>

      {/* 3-Panel Workspace */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* PANEL 1: SOURCES */}
        <section className="w-72 sm:w-80 border-r border-white/10 flex flex-col bg-[#141424]">
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white/90 tracking-wide uppercase">Sources</h2>
              <button className="p-1 hover:bg-white/10 rounded text-neutral-400">
                <FileText className="w-4 h-4" />
              </button>
            </div>
            
            <button 
              className="w-full flex items-center gap-2 justify-center py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-colors text-white/80"
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <Plus className="w-4 h-4" /> Add sources
            </button>
            <input type="file" id="file-upload" className="hidden" accept=".pdf" onChange={handleFileUpload} />
          </div>

          <div className="p-4 flex-1 overflow-y-auto">
            <div className="relative mb-4">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input 
                type="text" 
                placeholder="Search the web for new sources" 
                className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>
            
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2 text-xs font-medium text-neutral-400">
                <CheckSquare className="w-3.5 h-3.5 text-blue-500" /> Select all
              </div>
            </div>

            <ul className="space-y-1">
              {notebook.sources.map(source => (
                <li key={source.id} className="group flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <CheckSquare className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <div className="w-6 h-6 bg-yellow-500/20 text-yellow-500 rounded flex items-center justify-center flex-shrink-0">
                      <File className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-medium text-white/80 truncate">{source.name}</span>
                  </div>
                  <button 
                    onClick={() => handleDeleteSource(source.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded text-neutral-400 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
              {notebook.sources.length === 0 && (
                <p className="text-xs text-neutral-500 text-center py-6">No sources added yet.</p>
              )}
            </ul>
          </div>
          
          <div className="p-4 border-t border-white/5">
            <button 
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold shadow-[0_0_10px_rgba(37,99,235,0.2)] transition-all"
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <Upload className="w-4 h-4" /> Upload PDF
            </button>
          </div>
        </section>

        {/* PANEL 2: CHAT */}
        <section className="flex-1 flex flex-col min-w-0 bg-[#1a1a2e] border-r border-white/10">
          <div className="h-12 border-b border-white/5 flex items-center justify-between px-4 flex-none">
            <h2 className="text-sm font-bold text-white/90">Chat</h2>
            <div className="flex items-center gap-2">
              <button className="p-1 hover:bg-white/10 rounded text-neutral-400"><Sliders className="w-4 h-4" /></button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {notebook.chatHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="w-16 h-16 bg-blue-600/10 text-blue-500 rounded-full flex items-center justify-center mb-4">
                  <Globe className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">Start chatting to ask questions about your documents</h3>
                <p className="text-sm text-neutral-400 max-w-sm">
                  Upload documents in the Sources panel first, then ask questions here to get insights powered by AI.
                </p>
              </div>
            ) : (
              notebook.chatHistory.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-neutral-800 text-white rounded-br-sm' : 'bg-transparent border border-white/10 text-neutral-200 rounded-bl-sm'}`}>
                    <ReactMarkdown className="prose prose-invert prose-sm max-w-none">
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  <span className="text-[10px] text-neutral-500 mt-1 px-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
            {isGenerating && (
              <div className="flex items-start">
                <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-transparent border border-white/10 text-neutral-400 rounded-bl-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 bg-[#1a1a2e] flex-none">
            <div className="relative bg-[#23233b] border border-white/10 rounded-2xl overflow-hidden focus-within:border-white/30 focus-within:ring-1 focus-within:ring-white/30 transition-all">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={notebook.sources.length === 0}
                placeholder={notebook.sources.length === 0 ? "Upload a PDF to start chatting..." : "Ask a question or create something"}
                className="w-full bg-transparent border-none px-4 py-4 text-sm text-white resize-none outline-none min-h-[56px] max-h-32"
                rows={1}
              />
              <div className="flex items-center justify-between px-3 pb-3">
                <div className="flex items-center gap-1">
                  <button className="p-2 hover:bg-white/10 rounded-full text-neutral-400 transition-colors"><Paperclip className="w-4 h-4" /></button>
                  <button className="p-2 hover:bg-white/10 rounded-full text-neutral-400 transition-colors"><Globe className="w-4 h-4" /></button>
                  <button className="p-2 hover:bg-white/10 rounded-full text-neutral-400 transition-colors"><Mic className="w-4 h-4" /></button>
                </div>
                <button 
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || notebook.sources.length === 0 || isGenerating}
                  className={`p-2 rounded-full flex items-center justify-center transition-all ${chatInput.trim() && notebook.sources.length > 0 && !isGenerating ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-white/5 text-neutral-500'}`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="mt-2 text-center">
              <span className="text-[10px] font-medium text-neutral-500 bg-white/5 px-2 py-0.5 rounded-full">
                {notebook.sources.length} active sources
              </span>
            </div>
          </div>
        </section>

        {/* PANEL 3: STUDIO / SUMMARY */}
        <section className="w-80 sm:w-96 flex flex-col bg-[#141424]">
          <div className="h-12 border-b border-white/5 flex items-center px-4 flex-none">
            <div className="text-xs font-semibold text-neutral-400 flex items-center gap-2">
              <span className="hover:text-white cursor-pointer transition-colors">Studio</span>
              <span>›</span>
              <span className="text-white/80">Note</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6">
            {isSummarizing ? (
              <div className="flex flex-col items-center justify-center h-full text-neutral-400 space-y-4">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm">Generating summary...</p>
              </div>
            ) : notebook.summary ? (
              <div className="prose prose-invert prose-sm md:prose-base prose-headings:text-white/90 prose-p:text-neutral-300 prose-li:text-neutral-300 max-w-none">
                <h1 className="text-2xl font-bold mb-6 pb-2 border-b border-white/10">{notebook.sources[0]?.name || notebook.title}</h1>
                <ReactMarkdown>{notebook.summary}</ReactMarkdown>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <FileText className="w-12 h-12 text-neutral-600 mb-4" />
                <p className="text-sm text-neutral-400 max-w-[200px]">No summary yet. Upload documents to generate one.</p>
              </div>
            )}
          </div>
          
          <div className="p-4 border-t border-white/5 bg-[#1a1a2e] flex-none flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 cursor-pointer transition-colors">
              <Info className="w-3.5 h-3.5" /> Saved responses are view only
            </div>
            <button className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors">
              Convert to source
            </button>
          </div>
        </section>

      </main>
    </div>
  );
}

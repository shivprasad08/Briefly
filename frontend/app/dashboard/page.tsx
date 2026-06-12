"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NotebookCard } from '@/components/ui/notebook-card';
import { store, Notebook } from '@/lib/store';
import { Settings, User, X } from 'lucide-react';

export default function NotebookGallery() {
  const router = useRouter();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setNotebooks(store.getNotebooks());
    const storedKey = localStorage.getItem('anthropic_api_key');
    if (storedKey) setApiKey(storedKey);
  }, []);

  const handleCreateNotebook = () => {
    const title = prompt("Enter a title for the new notebook:");
    if (title !== null) {
      const newNotebook = store.createNotebook(title || 'Untitled Notebook');
      setNotebooks(store.getNotebooks());
      router.push(`/notebook/${newNotebook.id}`);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this notebook?")) {
      store.deleteNotebook(id);
      setNotebooks(store.getNotebooks());
    }
  };

  const handleRename = (id: string, newTitle: string) => {
    store.updateNotebook(id, { title: newTitle });
    setNotebooks(store.getNotebooks());
  };

  const handleSaveSettings = () => {
    localStorage.setItem('anthropic_api_key', apiKey);
    setIsSettingsOpen(false);
  };

  if (!isMounted) return <div className="min-h-screen bg-[#1a1a2e] text-white"></div>;

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white selection:bg-white/20">
      {/* Top Navbar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-xl font-bold shadow-[0_0_15px_rgba(37,99,235,0.5)]">
            B
          </div>
          <h1 className="text-xl font-bold tracking-tight">Briefly</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-neutral-300 hover:text-white"
          >
            <Settings className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center border border-white/20">
            <User className="w-4 h-4 text-neutral-300" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <h2 className="text-3xl font-bold mb-8 tracking-tight">Recent notebooks</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <NotebookCard 
            isCreateCard={true} 
            onCreate={handleCreateNotebook} 
          />
          {notebooks.map((notebook) => (
            <NotebookCard 
              key={notebook.id}
              notebook={notebook}
              onDelete={handleDelete}
              onRename={handleRename}
            />
          ))}
        </div>
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1f1f38] border border-white/10 rounded-xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Settings</h3>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 hover:bg-white/10 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">
                  Anthropic API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                />
                <p className="text-xs text-neutral-500 mt-2">
                  Your API key is stored locally in your browser and used to securely proxy requests through the Next.js server.
                </p>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium shadow-[0_0_10px_rgba(37,99,235,0.3)] transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import React, { useState } from 'react';
import { MoreVertical, Plus } from 'lucide-react';
import { Notebook } from '@/lib/store';
import Link from 'next/link';

interface NotebookCardProps {
  notebook?: Notebook;
  isCreateCard?: boolean;
  onCreate?: () => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, newTitle: string) => void;
}

export function NotebookCard({ notebook, isCreateCard, onCreate, onDelete, onRename }: NotebookCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(notebook?.title || '');

  if (isCreateCard) {
    return (
      <div 
        onClick={onCreate}
        className="h-48 rounded-xl border-2 border-dashed border-neutral-700 hover:border-neutral-500 bg-neutral-900/50 hover:bg-neutral-800/50 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 group"
      >
        <div className="w-12 h-12 rounded-full bg-neutral-800 group-hover:bg-neutral-700 flex items-center justify-center mb-4 transition-colors">
          <Plus className="w-6 h-6 text-neutral-400 group-hover:text-white" />
        </div>
        <span className="text-neutral-400 group-hover:text-white font-medium">Create new notebook</span>
      </div>
    );
  }

  if (!notebook) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (onRename && editTitle.trim()) onRename(notebook.id, editTitle.trim());
      setIsEditing(false);
      setShowMenu(false);
    } else if (e.key === 'Escape') {
      setEditTitle(notebook.title);
      setIsEditing(false);
      setShowMenu(false);
    }
  };

  const handleBlur = () => {
    if (onRename && editTitle.trim() && editTitle !== notebook.title) {
      onRename(notebook.id, editTitle.trim());
    }
    setIsEditing(false);
    setShowMenu(false);
  };

  const formattedDate = new Date(notebook.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div 
      className="relative h-48 rounded-xl p-5 flex flex-col justify-between cursor-pointer transition-all duration-200 hover:ring-2 hover:ring-white/20 group overflow-hidden shadow-lg"
      style={{ backgroundColor: notebook.color }}
      onMouseLeave={() => setShowMenu(false)}
    >
      {/* Background glow effect on hover */}
      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      <div className="flex justify-between items-start relative z-10">
        <div className="text-3xl bg-black/20 w-10 h-10 rounded-lg flex items-center justify-center">
          {notebook.icon}
        </div>
        
        <div className="relative">
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1.5 rounded-md hover:bg-black/20 text-white/80 hover:text-white transition-colors"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-32 bg-neutral-900 border border-neutral-700 rounded-md shadow-xl overflow-hidden z-20">
              <button 
                className="w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsEditing(true);
                  setShowMenu(false);
                }}
              >
                Rename
              </button>
              <button 
                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-neutral-800 hover:text-red-300"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onDelete) onDelete(notebook.id);
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="relative z-10" onClick={(e) => e.stopPropagation()}>
          <input
            autoFocus
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="w-full bg-black/40 text-white font-bold text-lg rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      ) : (
        <Link href={`/notebook/${notebook.id}`} className="absolute inset-0 z-0" />
      )}
      
      {!isEditing && (
        <div className="relative z-10 pointer-events-none">
          <h3 className="text-white font-bold text-lg leading-tight mb-1 line-clamp-2">
            {notebook.title}
          </h3>
          <p className="text-white/60 text-xs font-medium">
            {formattedDate} &middot; {notebook.sources.length} sources
          </p>
        </div>
      )}
    </div>
  );
}

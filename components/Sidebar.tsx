
import React from 'react';
import { Folder } from '../types';
import { FolderIcon, TrashIcon } from './Icons';
import { translations, Language } from '../i18n';

interface Props {
  folders: Folder[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onDeleteFolder: (id: string) => void;
  language: Language;
}

export const Sidebar: React.FC<Props> = ({ folders, currentId, onSelect, onDeleteFolder, language }) => {
  const t = translations[language];

  return (
    <aside className="w-72 h-full glass-effect border-r border-gray-200 flex flex-col p-6 space-y-8 overflow-y-auto">
      <div>
        <h1 className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-1">
          {t.title}
        </h1>
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">{t.subtitle}</p>
      </div>

      <nav className="space-y-1">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">{t.folders}</h3>
        {folders.map(folder => (
          <div
            key={folder.id}
            onClick={() => onSelect(folder.id)}
            className={`group flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all ${
              currentId === folder.id 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
                : 'text-gray-600 hover:bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <FolderIcon />
              <span className="text-sm font-medium">{folder.id === 'all' ? t.allFiles : folder.name}</span>
            </div>
            {folder.id !== 'all' && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFolder(folder.id);
                }}
                className={`opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-white/20 transition-opacity ${
                  currentId === folder.id ? 'text-white' : 'text-gray-400 hover:text-red-500'
                }`}
              >
                <TrashIcon />
              </button>
            )}
          </div>
        ))}
      </nav>

      <div className="bg-indigo-50 p-4 rounded-2xl mt-auto">
        <p className="text-xs font-bold text-indigo-600 mb-1">AI Pro Tip</p>
        <p className="text-[11px] text-indigo-900 leading-relaxed opacity-80">
          {t.proTip}
        </p>
      </div>
    </aside>
  );
};

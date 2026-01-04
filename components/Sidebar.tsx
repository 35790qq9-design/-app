
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
  onCloudSync: (service: 'drive' | 'photos') => void;
  onCloudFetch: (service: 'drive' | 'photos') => void;
}

export const Sidebar: React.FC<Props> = ({ folders, currentId, onSelect, onDeleteFolder, language, onCloudSync, onCloudFetch }) => {
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

      <div className="space-y-4 pt-4 border-t border-gray-100">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">{t.cloudIntegration}</h3>
        
        <div className="space-y-2">
          {/* Google Drive Section */}
          <div className="bg-white/50 p-3 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <img src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" className="w-4 h-4" alt="Drive" />
              <span className="text-xs font-bold text-gray-700">{t.googleDrive}</span>
            </div>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => onCloudSync('drive')}
                className="text-[10px] font-black uppercase tracking-wider py-2 px-3 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
              >
                {t.syncToCloud}
              </button>
              <button 
                onClick={() => onCloudFetch('drive')}
                className="text-[10px] font-black uppercase tracking-wider py-2 px-3 border border-gray-100 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t.fetchFromCloud}
              </button>
            </div>
          </div>

          {/* Google Photos Section */}
          <div className="bg-white/50 p-3 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <img src="https://upload.wikimedia.org/wikipedia/commons/a/ad/Google_Photos_icon_%282020%29.svg" className="w-4 h-4" alt="Photos" />
              <span className="text-xs font-bold text-gray-700">{t.googlePhotos}</span>
            </div>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => onCloudSync('photos')}
                className="text-[10px] font-black uppercase tracking-wider py-2 px-3 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                {t.syncToCloud}
              </button>
              <button 
                onClick={() => onCloudFetch('photos')}
                className="text-[10px] font-black uppercase tracking-wider py-2 px-3 border border-gray-100 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t.fetchFromCloud}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-indigo-50 p-4 rounded-2xl mt-auto">
        <p className="text-xs font-bold text-indigo-600 mb-1">AI Pro Tip</p>
        <p className="text-[11px] text-indigo-900 leading-relaxed opacity-80">
          {t.proTip}
        </p>
      </div>
    </aside>
  );
};

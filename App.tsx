
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { analyzeImage } from './services/geminiService';
import { AppState, ImageItem, Folder, OCRText } from './types';
import { Sidebar } from './components/Sidebar';
import { ImageOverlay } from './components/ImageOverlay';
import { LiveAssistant } from './components/LiveAssistant';
import { PlusIcon } from './components/Icons';
import { translations, Language } from './i18n';

const LOCAL_STORAGE_KEY = 'visionary_hub_state_v1';

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>('en');
  const [state, setState] = useState<AppState>(() => {
    // Initial state hydration from localStorage
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved state", e);
      }
    }
    return {
      images: [],
      folders: [{ id: 'all', name: 'All Files' }],
      currentFolderId: 'all',
      searchQuery: '',
    };
  });

  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ active: boolean, service: string }>({ active: false, service: '' });
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);

  const t = translations[language];

  // Persistence Effect
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    
    // Show saving indicator briefly
    setIsSaving(true);
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => setIsSaving(false), 1000);
  }, [state]);

  const filteredImages = useMemo(() => {
    let imgs = state.images;
    if (state.currentFolderId && state.currentFolderId !== 'all') {
      imgs = imgs.filter(img => img.folderId === state.currentFolderId);
    }
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      imgs = imgs.filter(img => 
        img.name.toLowerCase().includes(q) || 
        img.category.toLowerCase().includes(q) ||
        (img.description && img.description.toLowerCase().includes(q)) ||
        img.ocrTexts.some(t => t.text.toLowerCase().includes(q))
      );
    }
    return imgs;
  }, [state.images, state.currentFolderId, state.searchQuery]);

  const selectedImage = useMemo(() => 
    state.images.find(img => img.id === selectedImageId),
    [state.images, selectedImageId]
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        const { category, description, texts } = await analyzeImage(base64);
        const newItem: ImageItem = {
          id: `img-${Date.now()}`,
          url: URL.createObjectURL(file), 
          base64, 
          name: file.name,
          category,
          description,
          ocrTexts: texts,
          folderId: 'all'
        };
        setState(prev => ({ ...prev, images: [newItem, ...prev.images] }));
      } catch (err) {
        console.error("Analysis failed", err);
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCloudSync = async (service: 'drive' | 'photos') => {
    if (state.images.length === 0) return;
    setSyncProgress({ active: true, service });
    await new Promise(r => setTimeout(r, 2000));
    alert(t.syncSuccess);
    setSyncProgress({ active: false, service: '' });
  };

  const handleCloudFetch = async (service: 'drive' | 'photos') => {
    setSyncProgress({ active: true, service });
    await new Promise(r => setTimeout(r, 1500));
    alert(t.importSuccess);
    setSyncProgress({ active: false, service: '' });
  };

  const handleVoiceCommand = useCallback((name: string, args: any) => {
    setState(prev => {
      switch (name) {
        case 'create_folder':
          if (prev.folders.some(f => f.name === args.name)) return prev;
          return {
            ...prev,
            folders: [...prev.folders, { id: `folder-${Date.now()}`, name: args.name }]
          };
        case 'search_items':
          setSelectedImageId(null);
          return { ...prev, searchQuery: args.query, currentFolderId: 'all' };
        default:
          return prev;
      }
    });
  }, []);

  const updateImageTitle = (id: string, newTitle: string) => {
    setState(prev => ({
      ...prev,
      images: prev.images.map(img => img.id === id ? { ...img, name: newTitle } : img)
    }));
  };

  const updateImageCategory = (id: string, newCategory: string) => {
    setState(prev => ({
      ...prev,
      images: prev.images.map(img => img.id === id ? { ...img, category: newCategory } : img)
    }));
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-900">
      <Sidebar 
        folders={state.folders} 
        currentId={state.currentFolderId} 
        language={language}
        onSelect={(id) => setState(prev => ({ ...prev, currentFolderId: id }))} 
        onDeleteFolder={(id) => setState(prev => ({
          ...prev, 
          folders: prev.folders.filter(f => f.id !== id),
          currentFolderId: prev.currentFolderId === id ? 'all' : prev.currentFolderId
        }))}
        onCloudSync={handleCloudSync}
        onCloudFetch={handleCloudFetch}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 glass-effect flex items-center justify-between px-8 z-10 border-b border-gray-200">
          <div className="flex-1 max-w-xl relative flex items-center">
            <input 
              type="text" 
              placeholder={t.searchPlaceholder} 
              className={`w-full bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl px-5 py-3 focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all pr-12 ${state.searchQuery ? 'border-blue-300 ring-2 ring-blue-50' : ''}`}
              value={state.searchQuery}
              onChange={(e) => setState(prev => ({ ...prev, searchQuery: e.target.value }))}
            />
            {state.searchQuery && (
              <button 
                onClick={() => setState(prev => ({ ...prev, searchQuery: '' }))}
                className="absolute right-4 p-1 rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-6 ml-6">
            {/* Auto-save indicator */}
            <div className={`flex items-center gap-2 transition-opacity duration-500 ${isSaving ? 'opacity-100' : 'opacity-0'}`}>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Auto-Saved</span>
            </div>

            {/* Language Toggle */}
            <button 
              onClick={() => setLanguage(l => l === 'en' ? 'zh' : 'en')}
              className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-200 shadow-sm text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-blue-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9s2.015-9 4.5-9m0 18c1.17 0 2.227-1.383 2.91-3.5M12 3c1.17 0 2.227 1.383 2.91 3.5m-5.82 0A15.903 15.903 0 0 1 12 3.5c1.17 0 2.227 1.383 2.91 3.5m-5.82 0A15.903 15.903 0 0 0 9.09 7.5c-1.17 0-2.227 1.383-2.91 3.5" />
              </svg>
              {language === 'en' ? 'CN' : 'EN'}
            </button>

            <label className="flex items-center gap-2 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white px-6 py-3 rounded-2xl cursor-pointer transition-all shadow-xl shadow-blue-100 font-bold active:scale-95 disabled:opacity-50">
              {isAnalyzing ? (
                <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : <PlusIcon />}
              <span>{t.upload}</span>
              <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isAnalyzing} />
            </label>
          </div>
        </header>

        {syncProgress.active && (
          <div className="bg-blue-600 text-white px-8 py-2 flex items-center justify-between animate-pulse">
            <span className="text-xs font-black uppercase tracking-[0.2em]">{t.syncing} {syncProgress.service}</span>
            <div className="h-1 w-64 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white w-1/2 animate-[progress_1.5s_infinite_linear]"></div>
            </div>
          </div>
        )}

        <section className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
          {selectedImage ? (
            <div className="max-w-5xl mx-auto">
              <button 
                onClick={() => setSelectedImageId(null)}
                className="mb-8 flex items-center gap-3 text-gray-400 hover:text-blue-600 font-bold uppercase tracking-wider text-xs transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                {t.back}
              </button>
              <div className="flex flex-col lg:flex-row gap-10">
                <div className="flex-1">
                  <ImageOverlay 
                    imageUrl={selectedImage.url || selectedImage.base64} 
                    texts={selectedImage.ocrTexts}
                    onUpdateText={(tid, txt) => {
                      setState(prev => ({
                        ...prev,
                        images: prev.images.map(img => img.id === selectedImage.id ? {
                          ...img,
                          ocrTexts: img.ocrTexts.map(t => t.id === tid ? { ...t, text: txt } : t)
                        } : img)
                      }));
                    }}
                    onRemoveText={(tid) => {
                      setState(prev => ({
                        ...prev,
                        images: prev.images.map(img => img.id === selectedImage.id ? {
                          ...img,
                          ocrTexts: img.ocrTexts.filter(t => t.id !== tid)
                        } : img)
                      }));
                    }}
                    onAddText={(x, y) => {
                      const newText: OCRText = { id: `manual-${Date.now()}`, text: 'New Text', x, y };
                      setState(prev => ({
                        ...prev,
                        images: prev.images.map(img => img.id === selectedImage.id ? {
                          ...img,
                          ocrTexts: [...img.ocrTexts, newText]
                        } : img)
                      }));
                    }}
                  />
                </div>
                <div className="w-full lg:w-96 space-y-6">
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">{t.fileIntel}</h3>
                    <div className="space-y-6">
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">{t.titleLabel}</label>
                        <input 
                          type="text"
                          className="w-full text-sm font-bold bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          value={selectedImage.name}
                          onChange={(e) => updateImageTitle(selectedImage.id, e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">{t.description}</label>
                        <p className="text-sm font-medium leading-relaxed text-gray-700 italic">"{selectedImage.description}"</p>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">{t.classification}</label>
                        <input 
                          type="text"
                          className="w-full text-xs font-black uppercase tracking-wider bg-blue-50 border border-blue-100 text-blue-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          value={selectedImage.category}
                          onChange={(e) => updateImageCategory(selectedImage.id, e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto">
              {state.searchQuery && (
                <div className="mb-8 flex items-center gap-4">
                   <h2 className="text-xl font-black text-gray-900">
                    {language === 'en' ? 'Search Results for' : '搜索结果：'} <span className="text-blue-600">"{state.searchQuery}"</span>
                   </h2>
                   <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-bold">
                    {filteredImages.length} {language === 'en' ? 'found' : '个结果'}
                   </span>
                </div>
              )}
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
                {filteredImages.length > 0 ? filteredImages.map(img => (
                  <div 
                    key={img.id} 
                    className="group flex flex-col cursor-pointer transition-all active:scale-95"
                    onClick={() => setSelectedImageId(img.id)}
                  >
                    <div className="aspect-[4/5] rounded-3xl overflow-hidden mb-4 relative shadow-md shadow-gray-200 group-hover:shadow-2xl group-hover:shadow-blue-100 transition-all group-hover:-translate-y-2 border-4 border-white">
                      <img src={img.url || img.base64} alt={img.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                        <p className="text-[10px] text-white/80 font-bold uppercase tracking-wider truncate mb-1">{img.category}</p>
                        <p className="text-xs text-white font-medium line-clamp-2">{img.description}</p>
                      </div>
                    </div>
                    <div className="px-1">
                      <p className="text-sm font-bold text-gray-800 truncate mb-1">{img.name}</p>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{img.ocrTexts.length} {t.ocrBlocks}</p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="col-span-full py-32 flex flex-col items-center justify-center text-gray-300">
                    <div className="w-24 h-24 mb-6 bg-gray-100 rounded-[2.5rem] flex items-center justify-center text-gray-200">
                       <PlusIcon />
                    </div>
                    <p className="text-lg font-black text-gray-400 uppercase tracking-widest">{t.emptyGallery}</p>
                    <p className="text-sm mt-2 text-gray-400">{t.emptySub}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>

      <LiveAssistant onCommand={handleVoiceCommand} language={language} />
    </div>
  );
};

export default App;

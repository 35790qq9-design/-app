
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { analyzeImage } from './services/geminiService';
import { AppState, ImageItem, Folder, OCRText } from './types';
import { Sidebar } from './components/Sidebar';
import { ImageOverlay } from './components/ImageOverlay';
import { PlusIcon, TrashIcon, FolderIcon, MicIcon } from './components/Icons';
import { translations, Language } from './i18n';

const LOCAL_STORAGE_KEY = 'visionary_hub_state_offline_v1';

// 定义语音识别接口类型
interface SpeechRecognitionEvent extends Event {
  results: {
    [key: number]: {
      [key: number]: {
        transcript: string;
      };
    };
  };
}

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>('zh');
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [state, setState] = useState<AppState>(() => {
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
      folders: [{ id: 'all', name: '全部文件' }],
      currentFolderId: 'all',
      searchQuery: '',
    };
  });

  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [batchSelectedIds, setBatchSelectedIds] = useState<string[]>([]);
  const [isMoving, setIsMoving] = useState(false);
  
  // 语音识别状态
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const saveTimeoutRef = useRef<number | null>(null);
  const t = translations[language];

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    setIsSaving(true);
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => setIsSaving(false), 800);
  }, [state]);

  // 处理创建文件夹并移动图片的逻辑
  const handleCreateFolderAndMove = useCallback((folderName: string) => {
    const newFolderId = `folder-${Date.now()}`;
    const newFolder: Folder = { id: newFolderId, name: folderName };

    setState(prev => {
      // 确定需要移动的图片 ID 列表
      let idsToMove: string[] = [];
      
      // 逻辑：如果开启了多选且有选中，则移动选中的；
      // 如果没有多选但正在查看一张图，则移动那张图；
      // 否则移动当前视图下过滤出的所有图片（符合用户说的“图片都送到那”）
      if (batchSelectedIds.length > 0) {
        idsToMove = [...batchSelectedIds];
      } else if (selectedImageId) {
        idsToMove = [selectedImageId];
      } else {
        // 移动当前视图展示的所有图片
        const currentImages = prev.images.filter(img => {
          const inFolder = prev.currentFolderId === 'all' || img.folderId === prev.currentFolderId;
          const matchesSearch = !prev.searchQuery || img.name.toLowerCase().includes(prev.searchQuery.toLowerCase());
          return inFolder && matchesSearch;
        });
        idsToMove = currentImages.map(img => img.id);
      }

      const nextImages = prev.images.map(img => 
        idsToMove.includes(img.id) ? { ...img, folderId: newFolderId } : img
      );

      return {
        ...prev,
        folders: [...prev.folders, newFolder],
        images: nextImages,
        currentFolderId: newFolderId 
      };
    });

    // 重置状态
    setBatchSelectedIds([]);
    setMultiSelectMode(false);
    setSelectedImageId(null);
  }, [batchSelectedIds, selectedImageId]);

  // 初始化原生语音识别
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = language === 'zh' ? 'zh-CN' : 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript.trim();
        
        // 1. 切换视图指令
        if (transcript.includes("切换视图") || transcript.includes("switch view")) {
          setViewMode(v => v === 'desktop' ? 'mobile' : 'desktop');
        } 
        // 2. 切换语言指令
        else if (transcript.includes("切换语言") || transcript.includes("switch language")) {
          setLanguage(l => l === 'en' ? 'zh' : 'en');
        } 
        // 3. 创建文件夹指令
        else if (transcript.startsWith("创建文件夹") || transcript.toLowerCase().startsWith("create folder")) {
          const folderName = transcript
            .replace(/创建文件夹/g, "")
            .replace(/create folder/gi, "")
            .trim();
          if (folderName) {
            handleCreateFolderAndMove(folderName);
          }
        }
        // 4. 普通搜索
        else {
          setState(prev => ({ ...prev, searchQuery: transcript }));
        }
      };
      recognitionRef.current = recognition;
    }
  }, [language, handleCreateFolderAndMove]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
  };

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
      const { category, description, texts } = await analyzeImage(base64, file.name);
      const newItem: ImageItem = {
        id: `img-${Date.now()}`,
        url: base64, 
        base64, 
        name: file.name,
        category,
        description,
        ocrTexts: texts,
        folderId: state.currentFolderId === 'all' ? 'all' : state.currentFolderId!
      };
      setState(prev => ({ ...prev, images: [newItem, ...prev.images] }));
      setIsAnalyzing(false);
    };
    reader.readAsDataURL(file);
  };

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

  const toggleBatchSelection = (id: string) => {
    setBatchSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBatchDelete = () => {
    if (!window.confirm(`确认删除这 ${batchSelectedIds.length} 项?`)) return;
    setState(prev => ({
      ...prev,
      images: prev.images.filter(img => !batchSelectedIds.includes(img.id))
    }));
    setBatchSelectedIds([]);
    setMultiSelectMode(false);
  };

  return (
    <div className={`flex h-screen overflow-hidden bg-slate-200 transition-all duration-500 items-center justify-center p-0 md:p-4 ${viewMode === 'mobile' ? 'bg-slate-300' : 'bg-gray-50'}`}>
      
      <div className={`flex h-full bg-white shadow-2xl transition-all duration-500 overflow-hidden ${
        viewMode === 'mobile' ? 'w-[375px] max-h-[812px] rounded-[3rem] border-[8px] border-slate-800' : 'w-full rounded-none md:rounded-3xl'
      }`}>
        
        {viewMode === 'desktop' && (
          <Sidebar 
            folders={state.folders} 
            currentId={state.currentFolderId} 
            language={language}
            onSelect={(id) => {
              setState(prev => ({ ...prev, currentFolderId: id }));
              setSelectedImageId(null);
              setBatchSelectedIds([]);
              setMultiSelectMode(false);
            }} 
            onDeleteFolder={(id) => setState(prev => ({
              ...prev, 
              folders: prev.folders.filter(f => f.id !== id),
              currentFolderId: prev.currentFolderId === id ? 'all' : prev.currentFolderId
            }))}
          />
        )}

        <main className="flex-1 flex flex-col overflow-hidden relative">
          <header className={`glass-effect flex flex-wrap items-center justify-between z-10 border-b border-gray-100 ${viewMode === 'mobile' ? 'px-4 py-3' : 'h-20 px-8'}`}>
            <div className={`flex-1 relative flex items-center gap-2 ${viewMode === 'mobile' ? 'w-full order-last mt-3' : 'max-w-md'}`}>
              <div className="relative flex-1">
                <input 
                  type="text" 
                  placeholder={t.searchPlaceholder} 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 pr-10 text-sm focus:ring-2 focus:ring-blue-400 outline-none transition-all"
                  value={state.searchQuery}
                  onChange={(e) => setState(prev => ({ ...prev, searchQuery: e.target.value }))}
                />
                <button 
                  onClick={toggleListening}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${
                    isListening ? 'bg-red-500 text-white animate-pulse' : 'text-gray-400 hover:bg-gray-200'
                  }`}
                  title="语音指令：'创建文件夹 [名称]'"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-2 ml-4">
              <button 
                onClick={() => setViewMode(v => v === 'desktop' ? 'mobile' : 'desktop')}
                className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                title="切换视图"
              >
                {viewMode === 'desktop' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
                  </svg>
                )}
              </button>

              {!selectedImageId && (
                <button 
                  onClick={() => {
                    setMultiSelectMode(!multiSelectMode);
                    setBatchSelectedIds([]);
                  }}
                  className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                    multiSelectMode ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-600'
                  }`}
                >
                  {multiSelectMode ? t.cancel : t.select}
                </button>
              )}

              <button 
                onClick={() => setLanguage(l => l === 'en' ? 'zh' : 'en')}
                className="px-3 py-2 bg-white rounded-xl border border-gray-200 text-[10px] font-black"
              >
                {language === 'en' ? 'CN' : 'EN'}
              </button>

              <label className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-xl cursor-pointer hover:bg-blue-700 transition-all text-sm font-bold shadow-lg">
                {isAnalyzing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <PlusIcon />}
                <span>{t.upload}</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isAnalyzing} />
              </label>
            </div>
          </header>

          {multiSelectMode && batchSelectedIds.length > 0 && (
            <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-black text-blue-700">{batchSelectedIds.length} {t.itemsSelected}</span>
              <div className="flex gap-2">
                <button 
                  onClick={handleBatchDelete}
                  className="px-2 py-1 bg-red-50 border border-red-100 rounded text-[10px] font-bold text-red-600"
                >
                  {t.deleteSelected}
                </button>
              </div>
            </div>
          )}

          <section className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50">
            {selectedImage ? (
              <div className="max-w-5xl mx-auto">
                <button 
                  onClick={() => setSelectedImageId(null)}
                  className="mb-6 flex items-center gap-2 text-gray-400 hover:text-blue-600 font-bold uppercase text-[10px]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                  </svg>
                  {t.back}
                </button>
                <div className={`flex flex-col gap-6 ${viewMode === 'desktop' ? 'lg:flex-row' : ''}`}>
                  <div className="flex-1">
                    <ImageOverlay 
                      imageUrl={selectedImage.url} 
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
                  <div className={`${viewMode === 'desktop' ? 'w-80' : 'w-full'} space-y-4`}>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">{t.fileIntel}</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">{t.titleLabel}</label>
                          <input 
                            type="text"
                            className="w-full text-xs font-bold bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                            value={selectedImage.name}
                            onChange={(e) => updateImageTitle(selectedImage.id, e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">{t.classification}</label>
                          <input 
                            type="text"
                            className="w-full text-xs font-bold bg-blue-50 border border-blue-100 text-blue-700 rounded-lg px-3 py-2 outline-none"
                            value={selectedImage.category}
                            onChange={(e) => updateImageCategory(selectedImage.id, e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">{t.description}</label>
                          <p className="text-[11px] text-gray-600 leading-relaxed italic">"{selectedImage.description}"</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredImages.length > 0 ? filteredImages.map(img => (
                  <div 
                    key={img.id} 
                    className={`group flex flex-col cursor-pointer transition-all active:scale-95 ${multiSelectMode ? 'relative' : ''}`}
                    onClick={() => multiSelectMode ? toggleBatchSelection(img.id) : setSelectedImageId(img.id)}
                  >
                    <div className={`aspect-square rounded-2xl overflow-hidden mb-2 relative shadow-sm border-2 ${
                      batchSelectedIds.includes(img.id) ? 'border-blue-500' : 'border-white'
                    }`}>
                      <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                      {multiSelectMode && (
                        <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          batchSelectedIds.includes(img.id) ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white/80 border-gray-300'
                        }`}>
                          {batchSelectedIds.includes(img.id) && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg>}
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] font-bold text-gray-700 truncate px-1">{img.name}</p>
                  </div>
                )) : (
                  <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-300">
                    <div className="w-16 h-16 mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                       <PlusIcon />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-widest">{t.emptyGallery}</p>
                  </div>
                )}
              </div>
            )}
          </section>
        </main>
      </div>
      
      {/* 语音录音状态浮层 */}
      {isListening && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl z-[100] animate-bounce">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
          <span className="text-sm font-bold tracking-widest">{t.listening}</span>
        </div>
      )}

      <div className={`fixed bottom-4 left-4 flex items-center gap-2 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-gray-100 shadow-xl transition-all duration-500 ${isSaving ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Saved</span>
      </div>
    </div>
  );
};

export default App;

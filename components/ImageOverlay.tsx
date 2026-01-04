
import React, { useState } from 'react';
import { OCRText } from '../types';
import { TrashIcon } from './Icons';

interface Props {
  imageUrl: string;
  texts: OCRText[];
  onUpdateText: (id: string, newText: string) => void;
  onRemoveText: (id: string) => void;
  onAddText: (x: number, y: number) => void;
}

export const ImageOverlay: React.FC<Props> = ({ imageUrl, texts, onUpdateText, onRemoveText, onAddText }) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (editingId) {
      setEditingId(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onAddText(x, y);
  };

  return (
    <div className="relative group cursor-crosshair overflow-hidden rounded-lg shadow-xl" onClick={handleImageClick}>
      <img src={imageUrl} alt="Uploaded content" className="w-full h-auto block" />
      <div className="absolute inset-0">
        {texts.map((t) => (
          <div
            key={t.id}
            className="absolute p-1 bg-white/40 hover:bg-white/90 backdrop-blur-sm rounded border border-white/50 transition-all flex items-center gap-2 group/item"
            style={{ left: `${t.x}%`, top: `${t.y}%`, transform: 'translate(-50%, -50%)' }}
            onClick={(e) => {
              e.stopPropagation();
              setEditingId(t.id);
            }}
          >
            {editingId === t.id ? (
              <input
                autoFocus
                className="bg-transparent border-none outline-none text-xs font-medium w-24"
                value={t.text}
                onChange={(e) => onUpdateText(t.id, e.target.value)}
                onBlur={() => setEditingId(null)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
              />
            ) : (
              <span className="text-xs font-medium cursor-text">{t.text}</span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemoveText(t.id);
              }}
              className="opacity-0 group-hover/item:opacity-100 hover:text-red-500 transition-opacity"
            >
              <TrashIcon />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

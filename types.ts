
export interface OCRText {
  id: string;
  text: string;
  x: number;
  y: number;
}

export interface ImageItem {
  id: string;
  url: string;
  base64: string;
  name: string;
  category: string;
  description: string; // New field for natural language search
  ocrTexts: OCRText[];
  folderId?: string;
}

export interface Folder {
  id: string;
  name: string;
}

export interface AppState {
  images: ImageItem[];
  folders: Folder[];
  currentFolderId: string | null;
  searchQuery: string;
}

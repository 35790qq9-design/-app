
import { GoogleGenAI, Type, GenerateContentResponse, Modality } from "@google/genai";
import { OCRText } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

export const analyzeImage = async (base64: string): Promise<{ category: string, description: string, texts: OCRText[] }> => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite-latest',
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64.split(',')[1],
            },
          },
          {
            text: "Analyze this image. 1. Identify a single best category. 2. Write a detailed 1-sentence description. 3. Extract all visible text and provide their approximate normalized coordinates (0-100 for x and y). Return ONLY a JSON object with keys 'category' (string), 'description' (string), and 'texts' (array of {text: string, x: number, y: number}).",
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          description: { type: Type.STRING },
          texts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
              },
              required: ["text", "x", "y"],
            },
          },
        },
        required: ["category", "description", "texts"],
      },
    },
  });

  const data = JSON.parse(response.text || "{}");
  return {
    category: data.category || "Uncategorized",
    description: data.description || "",
    texts: (data.texts || []).map((t: any, i: number) => ({ ...t, id: `ocr-${i}-${Date.now()}` })),
  };
};

export const startLiveSession = async (callbacks: any, tools: any[], language: string = 'en') => {
  const langPrompt = language === 'zh' 
    ? "你是一个智能语音助手。请使用中文回答。你可以帮助用户管理文件夹、搜索图片。你可以识别用户的指令如'创建文件夹'、'帮我找海滩照片'。" 
    : "You are an intelligent voice assistant. Please speak in English. Help users manage folders and search images. Extract keywords like 'beach' or 'receipt' for searching.";

  return ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks,
    config: {
      responseModalities: [Modality.AUDIO],
      tools: [{ functionDeclarations: tools }],
      systemInstruction: langPrompt,
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
      },
    },
  });
};

export const decodeBase64Audio = (base64: string) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const encodeAudioPCM = (data: Float32Array) => {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

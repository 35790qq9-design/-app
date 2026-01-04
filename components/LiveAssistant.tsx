
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { startLiveSession, decodeBase64Audio, encodeAudioPCM } from '../services/geminiService';
import { MicIcon } from './Icons';
import { Type } from '@google/genai';
import { Language } from '../i18n';

interface Props {
  onCommand: (command: string, args: any) => void;
  language: Language;
}

export const LiveAssistant: React.FC<Props> = ({ onCommand, language }) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  const stopAllAudio = useCallback(() => {
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const handleToggle = async () => {
    if (isActive) {
      if (sessionRef.current) {
        sessionRef.current.close();
      }
      setIsActive(false);
      return;
    }

    setIsConnecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });

      const tools = [
        {
          name: 'create_folder',
          description: 'Create a new folder to organize images.',
          parameters: {
            type: Type.OBJECT,
            properties: { name: { type: Type.STRING, description: 'The name of the new folder' } },
            required: ['name'],
          },
        },
        {
          name: 'search_items',
          description: 'Search for images globally based on a description, text, category, or keyword.',
          parameters: {
            type: Type.OBJECT,
            properties: { query: { type: Type.STRING, description: 'The search term or keywords extracted from user speech' } },
            required: ['query'],
          },
        }
      ];

      const sessionPromise = startLiveSession(
        {
          onopen: () => {
            setIsActive(true);
            setIsConnecting(false);
            const source = inputContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const base64 = encodeAudioPCM(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: { data: base64, mimeType: 'audio/pcm;rate=16000' } });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputContextRef.current!.destination);
          },
          onmessage: async (message: any) => {
            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData && audioContextRef.current) {
              const bytes = decodeBase64Audio(audioData);
              const dataInt16 = new Int16Array(bytes.buffer);
              const buffer = audioContextRef.current.createBuffer(1, dataInt16.length, 24000);
              const channelData = buffer.getChannelData(0);
              for (let i = 0; i < dataInt16.length; i++) {
                channelData[i] = dataInt16[i] / 32768.0;
              }

              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContextRef.current.currentTime);
              const source = audioContextRef.current.createBufferSource();
              source.buffer = buffer;
              source.connect(audioContextRef.current.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => sourcesRef.current.delete(source);
            }

            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                onCommand(fc.name, fc.args);
                sessionPromise.then(s => s.sendToolResponse({
                  functionResponses: { id: fc.id, name: fc.name, response: { status: 'success' } }
                }));
              }
            }

            if (message.serverContent?.interrupted) {
              stopAllAudio();
            }
          },
          onerror: () => setIsActive(false),
          onclose: () => setIsActive(false),
        },
        tools,
        language
      );

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error(err);
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed bottom-8 right-8 flex flex-col items-center gap-3 z-50">
      <div className={`p-4 rounded-2xl glass-effect shadow-2xl transition-all ${isActive ? 'scale-110 border-blue-400 ring-4 ring-blue-100' : 'scale-100'}`}>
        <button
          onClick={handleToggle}
          disabled={isConnecting}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
            isActive ? 'bg-blue-100' : 'bg-white hover:bg-gray-50'
          }`}
        >
          {isConnecting ? (
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <MicIcon active={isActive} />
          )}
        </button>
      </div>
      <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] bg-white/80 backdrop-blur-md px-4 py-1.5 rounded-full shadow-sm border border-gray-100">
        {isActive ? 'Gemini Listening' : (language === 'zh' ? '语音指令' : 'Voice Command')}
      </p>
    </div>
  );
};

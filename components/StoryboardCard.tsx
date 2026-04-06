import React, { useEffect } from 'react';
import { LyricSegment } from '../types';
import { generateImage } from '../services/geminiService';

interface StoryboardCardProps {
  segment: LyricSegment;
  onImageGenerated: (id: string, imageData: string) => void;
  onImageError: (id: string, error: string) => void;
  timestamp?: string;
  style: 'cartoon' | 'realistic';
}

export const StoryboardCard: React.FC<StoryboardCardProps> = ({ 
  segment, 
  onImageGenerated, 
  onImageError,
  timestamp,
  style
}) => {
  
  // Trigger image generation on mount if pending
  useEffect(() => {
    let isMounted = true;

    const fetchImage = async () => {
      if (segment.status === 'pending') {
        try {
          const base64Image = await generateImage(segment.imagePrompt, style);
          if (isMounted) {
            onImageGenerated(segment.id, base64Image);
          }
        } catch (err: any) {
          if (isMounted) {
            onImageError(segment.id, err.message || "Failed to generate image");
          }
        }
      }
    };

    fetchImage();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment.status, style]); // Depend on style so if it somehow changes for a pending item it updates

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden shadow-xl border border-slate-700 flex flex-col md:flex-row h-auto min-h-[300px] transition-transform hover:scale-[1.01] duration-300 relative group">
      
      {/* Timestamp Badge */}
      {timestamp && (
        <div className="absolute top-0 left-0 bg-indigo-600 text-white text-sm font-bold px-3 py-1 rounded-br-lg z-10 shadow-lg">
          {timestamp}
        </div>
      )}

      {/* Text Section */}
      <div className="p-6 md:w-1/2 flex flex-col justify-center border-b md:border-b-0 md:border-r border-slate-700 bg-slate-800/50 pt-10 md:pt-6">
        <div className="space-y-2 text-center md:text-left">
          {segment.lines.map((line, idx) => (
            <p key={idx} className="text-lg md:text-xl font-medium text-slate-200 leading-relaxed font-sans">
              {line}
            </p>
          ))}
        </div>
        <p className="mt-6 text-xs text-slate-500 uppercase tracking-wider font-bold">
          Scene Description
        </p>
        <p className="mt-1 text-sm text-slate-400 italic">
          "{segment.imagePrompt}"
        </p>
      </div>

      {/* Image Section */}
      <div className="md:w-1/2 relative bg-slate-900 flex items-center justify-center min-h-[300px]">
        {segment.status === 'success' && segment.imageData ? (
          <img 
            src={segment.imageData} 
            alt={segment.imagePrompt}
            className="w-full h-full object-cover animate-fade-in"
          />
        ) : segment.status === 'error' ? (
          <div className="p-4 text-center">
            <div className="text-red-400 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-red-400 text-sm">Failed to load image.</p>
            <button 
              onClick={() => onImageError(segment.id, "Retry initiated")} 
              className="mt-2 text-xs text-indigo-400 underline hover:text-indigo-300"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-slate-500">
            <div className="w-12 h-12 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
            <p className="text-sm font-medium animate-pulse">Creating {style} art...</p>
          </div>
        )}
      </div>
    </div>
  );
};
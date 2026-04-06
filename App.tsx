import React, { useState, useCallback } from 'react';
import { analyzeLyrics } from './services/geminiService';
import { LyricSegment } from './types';
import { StoryboardCard } from './components/StoryboardCard';
import { Button } from './components/Button';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';

const INITIAL_LYRICS_PLACEHOLDER = `Example:
Is this the real life?
Is this just fantasy?
Caught in a landslide,
No escape from reality.`;

// Helper to parse "MM:SS" or seconds to total seconds
const parseDuration = (input: string): number | null => {
  const cleanInput = input.trim();
  if (!cleanInput) return null;
  
  const parts = cleanInput.split(':');
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    return !isNaN(m) && !isNaN(s) ? m * 60 + s : null;
  }
  
  const s = parseInt(cleanInput, 10);
  return !isNaN(s) ? s : null;
};

// Helper to format total seconds back to "MM:SS"
const formatTime = (totalSeconds: number): string => {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function App() {
  const [lyrics, setLyrics] = useState('');
  const [durationInput, setDurationInput] = useState('');
  const [segments, setSegments] = useState<LyricSegment[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageStyle, setImageStyle] = useState<'cartoon' | 'realistic'>('cartoon');

  const handleLyricsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLyrics(e.target.value);
  };
  
  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDurationInput(e.target.value);
  };

  const handleGenerate = async () => {
    if (!lyrics.trim()) {
      setError("Please enter some lyrics first.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setSegments([]); // Clear previous results

    try {
      const analysisItems = await analyzeLyrics(lyrics);
      
      const newSegments: LyricSegment[] = analysisItems.map(item => ({
        id: uuidv4(),
        lines: item.lines.split('\n').filter(line => line.trim() !== ''),
        imagePrompt: item.visualPrompt,
        status: 'pending' // Initial status
      }));

      setSegments(newSegments);
    } catch (err: any) {
      setError("Failed to analyze lyrics. Please try again. " + (err.message || ''));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImageGenerated = useCallback((id: string, imageData: string) => {
    setSegments(prevSegments => 
      prevSegments.map(seg => 
        seg.id === id ? { ...seg, status: 'success', imageData } : seg
      )
    );
  }, []);

  const handleImageError = useCallback((id: string, errorMessage: string) => {
    // If it was a retry trigger (hacky way used in card), we might reset to pending
    if (errorMessage === "Retry initiated") {
       setSegments(prevSegments => 
        prevSegments.map(seg => 
          seg.id === id ? { ...seg, status: 'pending', error: undefined } : seg
        )
      );
      return;
    }

    setSegments(prevSegments => 
      prevSegments.map(seg => 
        seg.id === id ? { ...seg, status: 'error', error: errorMessage } : seg
      )
    );
  }, []);

  const handleDownloadAll = async () => {
    const successSegments = segments.filter(s => s.status === 'success' && s.imageData);
    if (successSegments.length === 0) return;

    setIsZipping(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("lyric-scenes");
      
      // Calculate times for filenames if duration is present
      const totalSeconds = parseDuration(durationInput);
      const interval = (totalSeconds !== null && segments.length > 0) ? totalSeconds / segments.length : 0;

      successSegments.forEach((seg, index) => {
        if (seg.imageData) {
          // Find the original index in the main segments array to get the correct time
          const originalIndex = segments.findIndex(s => s.id === seg.id);
          const timePrefix = totalSeconds !== null 
            ? `${formatTime(originalIndex * interval).replace(':', '-')}_` 
            : '';
            
          // imageData is "data:image/png;base64,..."
          const base64Data = seg.imageData.split(',')[1];
          const filename = `${timePrefix}scene-${index + 1}.png`;
          folder?.file(filename, base64Data, { base64: true });
        }
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lyric-scenes.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to zip", e);
      setError("Failed to create zip file.");
    } finally {
      setIsZipping(false);
    }
  };

  const clearAll = () => {
    setLyrics('');
    setSegments([]);
    setError(null);
  };
  
  // Calculate timing variables for rendering
  const totalSeconds = parseDuration(durationInput);
  const secondsPerSlide = (totalSeconds !== null && segments.length > 0) 
    ? totalSeconds / segments.length 
    : 0;

  return (
    <div className="min-h-screen bg-slate-900 pb-20">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <h1 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
              LyricToon
            </h1>
          </div>
          {segments.length > 0 && (
            <Button variant="secondary" onClick={clearAll} className="text-sm py-2 px-4">
              New Song
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-12">
        
        {/* Input Section - Only show if no results yet */}
        {segments.length === 0 && (
          <div className="max-w-2xl mx-auto animate-fade-in-up">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-4">Turn Lyrics into Visuals</h2>
              <p className="text-slate-400">Paste your favorite song lyrics below and watch as AI generates a storyboard for every few lines.</p>
            </div>

            <div className="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700">
              <div className="space-y-4">
                <div>
                  <label htmlFor="lyrics" className="block text-sm font-medium text-slate-300 mb-2">
                    Paste Lyrics
                  </label>
                  <textarea
                    id="lyrics"
                    rows={10}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-200 placeholder-slate-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-all"
                    placeholder={INITIAL_LYRICS_PLACEHOLDER}
                    value={lyrics}
                    onChange={handleLyricsChange}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="duration" className="block text-sm font-medium text-slate-300 mb-2">
                      Song Duration (Optional)
                      <span className="text-slate-500 text-xs font-normal ml-2">e.g., "3:45"</span>
                    </label>
                    <input
                      type="text"
                      id="duration"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-200 placeholder-slate-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      placeholder="MM:SS"
                      value={durationInput}
                      onChange={handleDurationChange}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Visual Style
                    </label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1 rounded-xl border border-slate-700">
                      <button
                        className={`py-2 rounded-lg text-sm font-medium transition-all ${imageStyle === 'cartoon' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                        onClick={() => setImageStyle('cartoon')}
                      >
                        Cartoon
                      </button>
                      <button
                        className={`py-2 rounded-lg text-sm font-medium transition-all ${imageStyle === 'realistic' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                        onClick={() => setImageStyle('realistic')}
                      >
                        Realistic
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              {error && (
                <div className="mt-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm flex items-center gap-2">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              <div className="mt-6">
                <Button 
                  onClick={handleGenerate} 
                  isLoading={isAnalyzing} 
                  className="w-full text-lg shadow-lg shadow-indigo-500/20"
                >
                  {isAnalyzing ? 'Analyzing Lyrics...' : `Generate ${imageStyle === 'cartoon' ? 'Cartoons' : 'Images'}`}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Results Section */}
        {segments.length > 0 && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Your Storyboard</h2>
                {totalSeconds !== null && (
                   <p className="text-slate-400 text-sm mt-1">
                     Total duration: {formatTime(totalSeconds)} • Interval: ~{secondsPerSlide.toFixed(1)}s per image
                   </p>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                 {/* Allow updating duration after generation */}
                 <div className="relative group">
                    <input
                      type="text"
                      className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-24 p-2.5 placeholder-slate-500"
                      placeholder="MM:SS"
                      value={durationInput}
                      onChange={handleDurationChange}
                      aria-label="Update Duration"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                 </div>

                <span className="text-slate-400 text-sm bg-slate-800 px-3 py-2 rounded-lg border border-slate-700 whitespace-nowrap">
                  {segments.filter(s => s.status === 'success').length} / {segments.length} Generated
                </span>
                <Button 
                  variant="primary" 
                  onClick={handleDownloadAll}
                  disabled={segments.filter(s => s.status === 'success').length === 0}
                  isLoading={isZipping}
                  className="!py-2 !px-4 text-sm whitespace-nowrap"
                >
                  Download ZIP
                </Button>
              </div>
            </div>

            <div className="grid gap-8">
              {segments.map((segment, index) => (
                <StoryboardCard 
                  key={segment.id} 
                  segment={segment} 
                  timestamp={totalSeconds !== null ? formatTime(index * secondsPerSlide) : undefined}
                  onImageGenerated={handleImageGenerated}
                  onImageError={handleImageError}
                  style={imageStyle}
                />
              ))}
            </div>
          </div>
        )}

      </main>
      
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
        }
        .animate-fade-in {
          animation: fadeIn 0.8s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
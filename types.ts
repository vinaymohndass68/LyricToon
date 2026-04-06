export interface LyricSegment {
  id: string;
  lines: string[];
  imagePrompt: string;
  imageData?: string; // Base64 string
  status: 'pending' | 'loading' | 'success' | 'error';
  error?: string;
}

export interface AnalysisResponseItem {
  lines: string; // The raw lines text
  visualPrompt: string; // The scene description
}

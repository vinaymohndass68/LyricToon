import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResponseItem } from '../types';

// Initialize the Gemini API client
// The API key must be provided in the environment variable API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Analyzes the lyrics and splits them into chunks with visual prompts.
 */
export const analyzeLyrics = async (lyrics: string): Promise<AnalysisResponseItem[]> => {
  try {
    // Using gemini-2.0-flash for text analysis
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `
        Analyze the following song lyrics. 
        Split the lyrics into logical segments of 3 to 4 lines maximum.
        For each segment, create a detailed visual description for an image that represents the mood and content of those lines.
        The description should be descriptive enough for an image generator, focusing on subjects, setting, lighting, and mood.
        
        Lyrics:
        ${lyrics}
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              lines: {
                type: Type.STRING,
                description: "The original lines from the lyrics for this segment."
              },
              visualPrompt: {
                type: Type.STRING,
                description: "A detailed visual description for the image."
              }
            },
            required: ["lines", "visualPrompt"]
          }
        }
      }
    });

    const text = response.text || "";
    const cleanText = text.replace(/```json\n?|```/g, '').trim();

    if (cleanText) {
      return JSON.parse(cleanText) as AnalysisResponseItem[];
    }
    throw new Error("No response text from Gemini.");
  } catch (error) {
    console.error("Error analyzing lyrics:", error);
    throw error;
  }
};

/**
 * Generates an image based on a prompt and style.
 */
export const generateImage = async (prompt: string, style: 'cartoon' | 'realistic' = 'cartoon'): Promise<string> => {
  try {
    let stylePrefix = "A vibrant, high-quality cartoon style illustration: ";
    
    if (style === 'realistic') {
      stylePrefix = "A cinematic, hyper-realistic, high-quality photograph, 8k resolution, highly detailed, photorealistic lighting: ";
    }

    const fullPrompt = `${stylePrefix}${prompt}`;

    // Switch to gemini-2.5-flash-image (Nano Banana) which is the standard for image generation
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: fullPrompt }],
      },
      config: {
        // Nano banana models do not support responseMimeType or responseSchema
      }
    });

    // Iterate through parts to find the image
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        const mimeType = part.inlineData.mimeType || 'image/png';
        return `data:${mimeType};base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("No image data found in response.");
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
};
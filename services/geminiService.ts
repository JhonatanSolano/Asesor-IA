import { GoogleGenAI, GenerateContentResponse, Content } from "@google/genai";
import { GeminiResponse } from '../types';
import { SYSTEM_PROMPT, GEMINI_RESPONSE_SCHEMA } from '../constants';

// Fix: Directly check and use process.env.API_KEY as per guidelines.
if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateBotResponse = async (
  history: Content[],
  currentUserInput: string,
  currentData: object
): Promise<GeminiResponse | null> => {
  try {
    const fullHistory: Content[] = [
      ...history,
      {
        role: 'user',
        parts: [{ text: `Esta es mi respuesta: "${currentUserInput}". Mis datos actuales son: ${JSON.stringify(currentData)}` }]
      }
    ];

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: fullHistory,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: GEMINI_RESPONSE_SCHEMA,
        temperature: 0.5,
      },
    });
    
    const jsonText = response.text.trim();
    if (!jsonText) {
        throw new Error("API returned an empty response.");
    }

    const parsedResponse: GeminiResponse = JSON.parse(jsonText);
    return parsedResponse;

  } catch (error) {
    console.error("Error generating bot response:", error);
    // In case of a failure, return null or a default error structure
    return {
      responseText: "¡Uy, parce! 😬 Parece que algo no está funcionando bien por acá. Dame un chance y vuelve a intentarlo más tarde, porfa.",
      action: "UPDATE_DATA",
    };
  }
};

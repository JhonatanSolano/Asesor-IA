import { GoogleGenAI, GenerateContentResponse, Content } from "@google/genai";
import { SYSTEM_PROMPT } from '../constants';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  if (!process.env.API_KEY) {
    console.error("API_KEY not found in environment variables.");
    return res.status(500).json({ error: "Server configuration error: API_KEY is missing." });
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const { history, currentUserInput, currentData } = req.body;

    if (!history || !currentUserInput || !currentData) {
        return res.status(400).json({ error: 'Missing required body parameters: history, currentUserInput, currentData' });
    }

    const fullHistory: Content[] = [
      ...history,
      {
        role: 'user',
        parts: [{ text: `Esta es mi respuesta: "${currentUserInput}". Mis datos actuales son: ${JSON.stringify(currentData)}` }]
      }
    ];

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: fullHistory,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.5,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    
    const jsonText = response.text.trim();
    if (!jsonText) {
        throw new Error("API returned an empty response.");
    }
    
    // Robust JSON parsing: handle potential markdown code blocks
    let cleanJsonText = jsonText;
    if (cleanJsonText.startsWith("```json")) {
        cleanJsonText = cleanJsonText.slice(7, -3).trim();
    } else if (cleanJsonText.startsWith("```")) {
        cleanJsonText = cleanJsonText.slice(3, -3).trim();
    }

    const responseObject = JSON.parse(cleanJsonText);
    
    return res.status(200).json(responseObject);

  } catch (error) {
    console.error("Error in serverless function:", error);
    const errorMessage = {
      responseText: "¡Uy, parce! 😬 Parece que algo no está funcionando bien por acá. Dame un chance y vuelve a intentarlo más tarde, porfa.",
      action: "UPDATE_DATA",
    };
    return res.status(500).json(errorMessage);
  }
}

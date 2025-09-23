import { GoogleGenAI, GenerateContentResponse, Content } from "@google/genai";
import { SYSTEM_PROMPT, GEMINI_RESPONSE_SCHEMA } from '../constants';


export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  if (!process.env.VITE_GEMINI_API_KEY) {
    console.error("API_KEY not found in environment variables.");
    return res.status(500).json({ error: "Server configuration error: API_KEY is missing." });
  }

  const ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY });

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
      responseMimeType: "application/json",
      responseSchema: GEMINI_RESPONSE_SCHEMA as any, // Revisa que GEMINI_RESPONSE_SCHEMA sea válido
      temperature: 0.5,
    },
  });

  const jsonText = response.text.trim();
  if (!jsonText) {
    throw new Error("API returned an empty response.");
  }

  // Parsear el JSON para validar
  let parsedResponse;
  try {
    parsedResponse = JSON.parse(jsonText);
  } catch (parseError) {
    console.error("Invalid JSON response from API:", jsonText);
    throw new Error("API returned invalid JSON.");
  }

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).send(jsonText);
} catch (error) {
  console.error("Error in serverless function:", error);
  const errorMessage = {
    responseText: "¡Uy, parce! 😬 Parece que algo no está funcionando bien por acá. Dame un chance y vuelve a intentarlo más tarde, porfa.",
    action: "UPDATE_DATA",
  };
  return res.status(500).json(errorMessage);
}

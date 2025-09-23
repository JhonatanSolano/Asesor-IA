import { GoogleGenerativeAI, GenerateContentResponse, Content } from "@google/genai";
import { SYSTEM_PROMPT, GEMINI_RESPONSE_SCHEMA } from '../constants';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!process.env.API_KEY) {
    console.error("API_KEY not found in environment variables.");
    return res.status(500).json({ error: "Server configuration error: API_KEY is missing." });
  }

  const ai = new GoogleGenerativeAI({ apiKey: process.env.API_KEY });

  try {
    const { history, currentUserInput, currentData } = req.body;

    if (!history || !currentUserInput || !currentData) {
      return res.status(400).json({ error: 'Missing required body parameters' });
    }

    const fullHistory: Content[] = [
      ...history,
      { role: 'user', parts: [{ text: `Respuesta: "${currentUserInput}". Datos: ${JSON.stringify(currentData)}` }] }
    ];

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Asegurado como válido
      contents: fullHistory,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: GEMINI_RESPONSE_SCHEMA as any,
        temperature: 0.5,
      },
    });

    const jsonText = response.text.trim();
    if (!jsonText) throw new Error("API returned empty response");

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(jsonText);
    } catch {
      throw new Error("Invalid JSON from API");
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(jsonText);
  } catch (error) {
    console.error("Error in serverless function:", error);
    return res.status(500).json({
      error: `¡Uy, parce! Algo falló: ${error.message}`,
    });
  }
}

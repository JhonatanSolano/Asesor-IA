import { GoogleGenerativeAI, GenerateContentResponse, Content } from "@google/generative-ai";
import { SYSTEM_PROMPT, GEMINI_RESPONSE_SCHEMA } from '../constants';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY not found in environment variables.");
    return res.status(500).json({ error: "Server configuration error: GEMINI_API_KEY is missing." });
  }

  const ai = new GoogleGenerativeAI({ apiKey });

  try {
    const { history, currentUserInput, currentData } = req.body ?? {};

    if (!history || !currentUserInput || !currentData) {
      return res.status(400).json({ error: 'Missing required body parameters: history, currentUserInput, currentData' });
    }

    const fullHistory: Content[] = [
      ...history,
      { role: 'user', parts: [{ text: `Respuesta: "${currentUserInput}". Datos: ${JSON.stringify(currentData)}` }] }
    ];

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: fullHistory,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: GEMINI_RESPONSE_SCHEMA as any,
        temperature: 0.5,
      },
    });

    
    console.log("Raw AI response:", JSON.stringify(response, null, 2));

    
    let jsonText: string | undefined;

    
    if ((response as any).text) {
      jsonText = String((response as any).text).trim();
    }

    
    if (!jsonText) {
      const out = (response as any).output ?? (response as any).candidates ?? (response as any).responses;
      if (Array.isArray(out) && out.length > 0) {
        // Busca propiedades comunes
        const candidate = out[0];
        jsonText = (candidate?.text || candidate?.content?.map((c: any)=>c.text).join('') || candidate?.message || undefined);
      }
    }

    
    if (!jsonText && (response as any).output && Array.isArray((response as any).output) && (response as any).output[0]?.content) {
      const c = (response as any).output[0].content;
      if (Array.isArray(c)) {
        jsonText = c.map((p: any) => p.text || '').join('').trim();
      }
    }

    if (!jsonText) {
      console.error("Could not find text content in AI response.");
      return res.status(502).json({ error: "Invalid response from AI provider (no text content)." });
    }

  
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err) {
      console.warn("AI returned non-JSON text; returning raw text. JSON parse error:", err);
      // si esperas JSON estrictamente, devuelve error; si no, devuelve raw
      // return res.status(502).json({ error: "AI returned invalid JSON" });
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(jsonText);
    }

    
    return res.status(200).json(parsed);

  } catch (error: any) {
    console.error("Error in serverless function:", error);
    const message = (error && error.message) ? error.message : String(error);
    return res.status(500).json({
      error: `Server error: ${message}`,
    });
  }
}

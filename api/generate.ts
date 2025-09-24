import * as SDK from "@google/generative-ai"; // <- mantén esto si ese es el package que tienes
import { SYSTEM_PROMPT, GEMINI_RESPONSE_SCHEMA } from "../constants";

type AnyClient = any;

function createClient(apiKey: string): AnyClient {
  // Intenta detectar/instanciar el cliente según la forma que exporte la librería.
  const exported = (SDK as any) || {};

  // Posibles nombres de clase/factory exportados
  const Candidates = [
    exported.GoogleGenerativeAI,
    exported.GoogleGenAI,
    exported.GoogleGenAIClient,
    exported.GoogleGenAIClientV1,
    exported.default,
    exported // por si exporta la clase directamente
  ];

  for (const C of Candidates) {
    if (!C) continue;
    try {
      // 1) intenta constructor con objeto { apiKey }
      try {
        const inst = new C({ apiKey });
        if (inst) return inst;
      } catch (e) {
        // ignore
      }

      // 2) intenta constructor con string apiKey
      try {
        const inst = new C(apiKey);
        if (inst) return inst;
      } catch (e) {
        // ignore
      }

      // 3) si C es ya una instancia o un cliente usable (no constructor)
      if (typeof C === "object") return C;

      // 4) si es función que provee methods (factory)
      if (typeof C === "function") {
        try {
          const maybe = C({ apiKey });
          if (maybe) return maybe;
        } catch (e) {
          // ignore
        }
      }
    } catch (err) {
      // sigue al siguiente candidato
    }
  }

  // fallback: devuelve el SDK entero por si tiene métodos estáticos que podamos usar
  return SDK as any;
}

async function generateWithClient(ai: AnyClient, payload: any) {
  // intenta varias formas de invocar la generación
  // 1) ai.models.generateContent(...)
  if (ai?.models?.generateContent) {
    return ai.models.generateContent(payload);
  }

  // 2) ai.generateContent(...)
  if (ai?.generateContent) {
    return ai.generateContent(payload);
  }

  // 3) ai.create?.(...) / ai.predict?.(...) / SDK.generate?.(...)
  if (ai?.create) {
    return ai.create(payload);
  }
  if (ai?.predict) {
    return ai.predict(payload);
  }

  // 4) tal vez SDK (export) tiene un método standalone
  if ((SDK as any)?.generateContent) {
    return (SDK as any).generateContent(payload);
  }

  throw new Error("No se encontró un método válido para generar contenido en el SDK instalado.");
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY / API_KEY missing");
    return res.status(500).json({ error: "Server configuration error: GEMINI_API_KEY is missing." });
  }

  const ai = createClient(apiKey);

  try {
    const { h

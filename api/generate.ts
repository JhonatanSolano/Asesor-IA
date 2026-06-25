import { GoogleGenerativeAI } from "@google/generative-ai";
import { SYSTEM_PROMPT } from "../constants";

type ApiRequest = {
  method?: string;
  body?: {
    history?: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>;
    currentUserInput?: string;
    currentData?: Record<string, unknown>;
  };
};

type ApiResponse = {
  status?: (code: number) => ApiResponse;
  json?: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
  end?: (body?: string) => void;
  statusCode?: number;
};

type ChatContent = {
  role: "user" | "model";
  parts: Array<{ text: string }>;
};

function getApiKey(): string | undefined {
  return process.env.API_KEY || process.env.GEMINI_API_KEY;
}

function getModelName(): string {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

function getModelCandidates(): string[] {
  return Array.from(new Set([getModelName(), "gemini-2.5-flash-lite", "gemini-flash-lite-latest"]));
}

function sendJson(res: ApiResponse, statusCode: number, body: unknown) {
  if (typeof res.status === "function" && typeof res.json === "function") {
    return res.status(statusCode).json(body);
  }

  res.statusCode = statusCode;
  res.setHeader?.("Content-Type", "application/json");
  return res.end?.(JSON.stringify(body));
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function isRetryableModelError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /high demand|Service Unavailable|Too Many Requests|quota|429|503/i.test(message);
}

async function generateWithModel(
  apiKey: string,
  modelName: string,
  contents: ChatContent[]
): Promise<unknown> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: {
      role: "system",
      parts: [{ text: SYSTEM_PROMPT }],
    },
    generationConfig: {
      responseMimeType: "application/json",
    } as any,
  });

  const result = await model.generateContent({ contents });
  const responseText = result.response.text();
  return JSON.parse(extractJson(responseText));
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method Not Allowed" });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("Missing API_KEY or GEMINI_API_KEY environment variable.");
    return sendJson(res, 500, {
      error: "Falta configurar la variable de entorno API_KEY o GEMINI_API_KEY en el servidor.",
    });
  }

  const { history = [], currentUserInput = "", currentData = {} } = req.body || {};
  if (!currentUserInput.trim()) {
    return sendJson(res, 400, { error: "El mensaje del usuario está vacío." });
  }

  try {
    const prompt = [
      `Datos actuales del usuario: ${JSON.stringify(currentData)}`,
      `Mensaje actual del usuario: ${currentUserInput}`,
      "Responde únicamente con JSON válido siguiendo el formato indicado en el sistema.",
    ].join("\n\n");

    const contents: ChatContent[] = [
      ...history,
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ];

    let lastError: unknown;
    for (const modelName of getModelCandidates()) {
      try {
        const parsed = await generateWithModel(apiKey, modelName, contents);
        return sendJson(res, 200, parsed);
      } catch (error) {
        lastError = error;
        if (!isRetryableModelError(error)) {
          throw error;
        }

        console.warn(`Gemini model "${modelName}" is temporarily unavailable. Trying fallback model.`);
      }
    }

    throw lastError;
  } catch (error) {
    console.error("Error generating Gemini response:", error);
    const message = error instanceof Error ? error.message : String(error);

    if (/API key not valid|API_KEY_INVALID/i.test(message)) {
      return sendJson(res, 401, {
        error: "La API key de Gemini no es válida. Genera una clave nueva y configúrala como API_KEY o GEMINI_API_KEY.",
      });
    }

    if (/not found|not supported|ListModels/i.test(message)) {
      return sendJson(res, 502, {
        error: `El modelo de Gemini "${getModelName()}" no está disponible. Configura GEMINI_MODEL con un modelo vigente, por ejemplo gemini-2.5-flash.`,
      });
    }

    if (/high demand|Service Unavailable|Too Many Requests|quota|429|503/i.test(message)) {
      return sendJson(res, 503, {
        error: "Gemini está saturado o sin cuota temporalmente. Intenta de nuevo en unos segundos.",
      });
    }

    return sendJson(res, 500, {
      error: "No se pudo generar la respuesta con Gemini. Revisa la API key y los logs del servidor.",
    });
  }
}

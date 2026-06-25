type ApiRequest = {
  method?: string;
  body?: {
    history?: ChatContent[];
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

const SYSTEM_PROMPT = `
Eres "Asesor-IA: Tu Pana Financiero", un chatbot asesor financiero con una personalidad colombiana muy amigable, motivadora e informal. Tu objetivo es ayudar a los usuarios a organizar sus finanzas y establecer metas de ahorro realistas. Nunca das consejos de inversion en acciones, criptomonedas u otros instrumentos de alto riesgo.

Tu flujo de conversacion es estrictamente el siguiente:
1. Pregunta el nombre del usuario.
2. Pregunta los ingresos mensuales en pesos colombianos.
3. Pregunta los gastos mensuales totales en pesos colombianos.
4. Pregunta el nombre de la meta de ahorro.
5. Pregunta el monto total de la meta.
6. Pregunta el plazo para la meta.
7. Solo cuando tengas todos los datos, haces el analisis final.

Reglas:
- Pregunta una sola cosa a la vez.
- Calcula goalTimelineInMonths. Si el usuario dice "1 año", son 12 meses. Si dice "6 meses", son 6 meses.
- Calcula ahorroMensual = (ingresos - gastos) * 0.20.
- Calcula ahorroNecesarioMensual = monto de la meta / goalTimelineInMonths.
- Calcula progresoPorcentaje = (ahorroMensual / ahorroNecesarioMensual) * 100.
- isViable es true si ahorroMensual > 0 y progresoPorcentaje >= 50%.
- Genera 3 sugerencias.
- Siempre responde con JSON puro, sin markdown fences.
- El JSON debe tener: responseText, action, updatedData y opcionalmente analysis.
- action debe ser "UPDATE_DATA" o "END".
`;

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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRetryableModelError(error: unknown): boolean {
  return /high demand|Service Unavailable|Too Many Requests|quota|429|503/i.test(getErrorMessage(error));
}

async function generateWithModel(
  apiKey: string,
  modelName: string,
  contents: ChatContent[]
): Promise<unknown> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents,
      generationConfig: {
        responseMimeType: "application/json",
      },
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(responseText || `Gemini API error ${response.status}`);
  }

  const data = JSON.parse(responseText);
  const modelText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!modelText) {
    throw new Error("Gemini response did not include text content.");
  }

  return JSON.parse(extractJson(modelText));
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
      "Responde unicamente con JSON valido siguiendo el formato indicado en el sistema.",
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
    const message = getErrorMessage(error);

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

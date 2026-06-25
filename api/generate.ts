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
Eres "Prep Matemática", un tutor para estudiantes colombianos que preparan examen de admisión UNAL e ICFES Saber 11. Tu trabajo es ayudar a resolver preguntas, crear ejercicios tipo examen, practicar por tema, revisar errores y proponer rutas cortas de estudio.

Estilo:
- Habla en español colombiano claro, amable y directo para estudiantes.
- Sé conciso, útil y directo. Evita discursos largos.
- Usa emojis con moderación: 🧠, 📝, 🎯, 🔍, 📚, ✅.
- No inventes datos del ICFES como puntajes oficiales si no son necesarios.
- Si falta información, haz una sola pregunta concreta.
- Cuando resuelvas matemáticas, muestra procedimiento verificable y evita saltos grandes.
- Usa LaTeX simple y legible para las expresiones matemáticas: \(x^2 - 4\), \(\frac{3}{5}\), \(\sqrt{16}\), \(f(x)=2x+1\).
- Para fórmulas largas usa una línea separada con LaTeX entre \[ y \].
- Acompaña cada fórmula con explicación en palabras sencillas.

Modos según currentData.mode:
1. solve: resolver una pregunta puntual.
   Formato recomendado:
   **Tema:** ...
   **Idea clave:** ...
   **Solución paso a paso:**
   1. ...
   2. ...
   **Respuesta:** ...
   **Truco PREICFES:** ...
   **Ejercicio parecido:** ...

2. generate: generar ejercicios tipo ICFES.
   Si el usuario no indica tema, cantidad o dificultad, pregunta lo que falte.
   Si sí está claro, entrega de una vez las preguntas con opciones A, B, C, D y al final una sección **Soluciones**.
   No vuelvas a pedir el tema/cantidad/dificultad si el mensaje ya los trae.

3. practice: practicar por tema.
   Propón una pregunta a la vez, espera la respuesta del estudiante y luego retroalimenta.
   Si el usuario pide varias, puedes dar una mini-ruta de práctica.

4. review: revisar un error.
   Explica por qué la respuesta del usuario falla, cuál era la idea correcta y cómo evitar ese error.
   Formato:
   **Dónde estuvo el error:** ...
   **Corrección:** ...
   **Atajo mental:** ...
   **Pregunta similar:** ...

5. guide: crear plan de estudio.
   Produce una ruta breve y accionable: temas, orden de estudio, práctica sugerida y mini-meta diaria.

Siempre responde con JSON puro, sin markdown fences.
El JSON debe tener exactamente:
{
  "responseText": "respuesta en Markdown",
  "action": "RESPOND"
}
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

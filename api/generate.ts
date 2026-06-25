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

const SYSTEM_PROMPT = String.raw`
Eres "Matemáticas", un tutor experto en matemáticas para estudiantes colombianos que preparan examen de admisión UNAL e ICFES Saber 11. Actúa como un profesor de alto nivel: riguroso, claro, pedagógico y orientado a examen. Tu trabajo es resolver preguntas, crear ejercicios tipo examen, practicar por tema, revisar errores y proponer rutas cortas de estudio.

Estilo:
- Habla en español colombiano claro, amable y directo para estudiantes.
- Sé profesional, conciso y didáctico. Evita discursos largos, pero no sacrifiques claridad matemática.
- Usa emojis con moderación: 🧠, 📝, 🎯, 🔍, 📚, ✅.
- Habla de forma neutral para ambos exámenes: admisión UNAL e ICFES Saber 11. No digas "truco PREICFES", "truco ICFES" o "truco UNAL" salvo que el estudiante pregunte por uno en específico.
- No inventes datos oficiales de ICFES o UNAL si no son necesarios.
- Si falta información, haz una sola pregunta concreta.
- Cuando resuelvas matemáticas, muestra procedimiento verificable y evita saltos grandes.
- Cuando el estudiante responda un ejercicio, primero verifica si su respuesta es correcta. No empieces con "bien", "correcto", "muy bien" o frases de aprobación si la respuesta está mal o incompleta.
- Si la respuesta del estudiante está mal, empieza con una corrección amable y precisa: "Casi, pero hay un detalle..." o "Revisemos: esa opción no es la correcta porque...". Luego explica el error y muestra el camino correcto.
- Si la respuesta está parcialmente bien, reconoce solo la parte correcta y señala claramente qué falta corregir.
- En todas las opciones/modos, usa LaTeX simple y legible para expresiones matemáticas en formato KaTeX/Markdown: $x^2 - 4$, $\frac{3}{5}$, $\sqrt{16}$, $f(x)=2x+1$.
- Para fórmulas largas usa bloque con doble dólar:
  $$
  \frac{a}{b}=\frac{c}{d}
  $$
- Acompaña cada fórmula con explicación en palabras sencillas.
- Si generas ejercicios, opciones o soluciones, las expresiones matemáticas también deben ir en LaTeX.
- Escribe variables, razones, ecuaciones, porcentajes, funciones, fracciones y raíces en LaTeX.
- En pasos algebraicos, usa una fórmula por línea cuando sea necesario. Ejemplo:
  $$
  x = \frac{150000 \cdot 60000}{250000}
  $$
- Para dinero o cantidades en texto, escribe "COP 150.000" en vez de usar el símbolo "$", para no confundirlo con delimitadores de LaTeX.
- No uses el formato incorrecto [ \frac{a}{b} ]. El formato correcto es $$\frac{a}{b}$$.
- No uses el formato incorrecto $(x)$. El formato correcto es $x$.
- Mantén notación consistente y evita errores algebraicos. Verifica mentalmente cada respuesta antes de entregarla.

Modos según currentData.mode:
1. solve: resolver una pregunta puntual.
   Formato recomendado:
   **Tema:** ...
   **Idea clave:** ...
   **Solución paso a paso:**
   1. ...
   2. ...
   **Respuesta:** ...
   **Consejo para examen:** ...
   **Ejercicio parecido:** ...
   Usa LaTeX en el enunciado, desarrollo y respuesta cuando haya símbolos o fórmulas.

2. generate: generar ejercicios tipo examen.
   Si el usuario no indica tema, cantidad o dificultad, pregunta lo que falte.
   Si sí está claro, entrega de una vez las preguntas con opciones A, B, C, D y al final una sección **Soluciones**.
   No vuelvas a pedir el tema/cantidad/dificultad si el mensaje ya los trae.
   Las preguntas deben ser originales, niveladas y con una única respuesta correcta. Usa LaTeX en enunciados, opciones y soluciones.

3. practice: practicar por tema.
   Propón una pregunta a la vez, espera la respuesta del estudiante y luego retroalimenta.
   Si el usuario pide varias, puedes dar una mini-ruta de práctica.
   Usa LaTeX en la pregunta y, cuando retroalimentes, explica el procedimiento con pasos cortos.

4. review: revisar un error.
   Explica por qué la respuesta del usuario falla, cuál era la idea correcta y cómo evitar ese error.
   Formato:
   **Dónde estuvo el error:** ...
   **Corrección:** ...
   **Atajo mental:** ...
   **Pregunta similar:** ...
   Usa LaTeX para comparar la operación incorrecta con la correcta.

5. guide: crear plan de estudio.
   Produce una ruta breve y accionable: temas, orden de estudio, práctica sugerida y mini-meta diaria.
   Si incluyes ejemplos de temas o ejercicios, usa LaTeX para las expresiones matemáticas.

Responde directamente en Markdown. No respondas JSON. No uses markdown fences salvo que el estudiante pida código.
`;

function normalizeLatex(text: string): string {
  return text
    .replace(/\\\[((?:.|\n)*?)\\\]/g, "\n$$$$\n$1\n$$$$\n")
    .replace(/\\\((.*?)\\\)/g, "$$$1$$")
    .replace(/^\s*\[\s*([\\A-Za-z0-9_{}^=+\-*/().,\s]+)\s*\]\s*$/gm, "\n$$$$\n$1\n$$$$\n")
    .replace(/\$\(([^)]+)\)\$/g, "$$$1$$")
    .replace(/\bTruco PREICFES\b/gi, "Consejo para examen")
    .replace(/\bTruco ICFES\b/gi, "Consejo para examen")
    .replace(/\bTruco UNAL\b/gi, "Consejo para examen");
}

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
): Promise<{ responseText: string; action: "RESPOND" }> {
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

  return {
    responseText: normalizeLatex(modelText.trim()),
    action: "RESPOND",
  };
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
      "Responde directamente al estudiante en Markdown claro y con LaTeX cuando corresponda.",
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

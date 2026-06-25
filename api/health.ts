type ApiResponse = {
  status?: (code: number) => ApiResponse;
  json?: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
  end?: (body?: string) => void;
  statusCode?: number;
};

function sendJson(res: ApiResponse, statusCode: number, body: unknown) {
  if (typeof res.status === "function" && typeof res.json === "function") {
    return res.status(statusCode).json(body);
  }

  res.statusCode = statusCode;
  res.setHeader?.("Content-Type", "application/json");
  return res.end?.(JSON.stringify(body));
}

export default function handler(_req: unknown, res: ApiResponse) {
  try {
    const apiKey = process.env.API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    return sendJson(res, 200, {
      ok: true,
      hasApiKey: Boolean(apiKey),
      hasGeminiApiKey: Boolean(geminiApiKey),
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      vercelEnv: process.env.VERCEL_ENV || "local",
    });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown health check error",
    });
  }
}

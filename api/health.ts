type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

export default function handler(_req: unknown, res: ApiResponse) {
  const apiKey = process.env.API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  return res.status(200).json({
    ok: true,
    hasApiKey: Boolean(apiKey),
    hasGeminiApiKey: Boolean(geminiApiKey),
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    vercelEnv: process.env.VERCEL_ENV || "local",
  });
}

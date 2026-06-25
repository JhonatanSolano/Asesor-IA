import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import generateHandler from './api/generate';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    process.env.API_KEY ||= env.API_KEY;
    process.env.GEMINI_API_KEY ||= env.GEMINI_API_KEY;

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        {
          name: 'local-api-generate',
          configureServer(server) {
            server.middlewares.use('/api/generate', (req, res) => {
              if (req.method !== 'POST') {
                res.statusCode = 405;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Method Not Allowed' }));
                return;
              }

              let body = '';
              req.on('data', chunk => {
                body += chunk;
              });
              req.on('end', async () => {
                try {
                  const parsedBody = body ? JSON.parse(body) : {};
                  await generateHandler(
                    { method: req.method, body: parsedBody },
                    {
                      status(code: number) {
                        res.statusCode = code;
                        return this;
                      },
                      json(payload: unknown) {
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(payload));
                      },
                    }
                  );
                } catch (error) {
                  server.config.logger.error(String(error));
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'Error interno del servidor local.' }));
                }
              });
            });
          },
        },
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

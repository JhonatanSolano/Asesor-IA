import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/asesor-ia-kappa/', // Ajusta al subpath de Vercel
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html'
    }
  }
});

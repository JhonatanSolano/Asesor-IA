import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/asesor-ia-kappa/', 
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html' 
    }
  }
});

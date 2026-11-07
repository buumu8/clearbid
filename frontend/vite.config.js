import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/clearbid/',
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:3001' },
  },
});

// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    'process.env.SPOTIFY_CLIENT_ID': JSON.stringify(process.env.SPOTIFY_CLIENT_ID),
    'process.env.TM_CLIENT_ID': JSON.stringify(process.env.TM_CLIENT_ID),
  },
});

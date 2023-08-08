import { defineConfig } from 'vite';

export default defineConfig({
  // ...other Vite configuration options...

  define: {
    'process.env.VITE_SPOTIFY_CLIENT_ID': JSON.stringify(process.env.VITE_SPOTIFY_CLIENT_ID),
    'process.env.VITE_TM_CLIENT_ID': JSON.stringify(process.env.VITE_TM_CLIENT_ID),
  },
});

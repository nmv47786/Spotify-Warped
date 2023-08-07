import dotenv from 'dotenv';
import express from 'express';
import path from 'path';

dotenv.config();

const app = express();

// Get the directory path using import.meta.url
const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname)));

app.get('/api/env', (req, res) => {
  const envData = {
    SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
    TM_CLIENT_ID: process.env.TM_CLIENT_ID,
  };
  res.json(envData);
});

app.use('/src', express.static(path.join(__dirname, 'src')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

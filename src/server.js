import express from 'express';
import fetch from 'node-fetch';

const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/events', async (req, res) => {
  const { artistName, apiKey } = req.query;
  const endpoint = `https://app.ticketmaster.com/discovery/v2/events.json?keyword=${encodeURIComponent(
    artistName
  )}&size=1&apikey=${apiKey}`;

  try {
    const response = await fetch(endpoint);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error(`Error fetching events for ${artistName}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server is running on port ${PORT}`);
});

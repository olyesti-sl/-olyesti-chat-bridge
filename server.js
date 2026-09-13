const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const SECRET = 'OlyestiRelay!AmberSky49#';
const SUPABASE_URL = 'https://esaeyeqjbktkcdrydgmy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzYWV5ZXFqYmt0a2NkcnlkZ215Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNzIwMDgsImV4cCI6MjEwNDc0ODAwOH0.jq909W6aOx7lIO6m_4wxwUv3vJ2xxowLbay2SJ7O1_8';

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let outgoingQueue = [];

const channel = db.channel('lounge-chat');
channel.on('broadcast', { event: 'message' }, ({ payload }) => {
  if (payload.fromSL) return;
  if (payload.name && payload.name.startsWith('🌐')) return;
  outgoingQueue.push({ speaker: payload.name, text: payload.text });
  if (outgoingQueue.length > 20) outgoingQueue.shift();
}).subscribe();

function checkSecret(req, res) {
  if (req.headers['x-olyesti-secret'] !== SECRET) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

app.post('/api/secondlife/incoming', async (req, res) => {
  if (!checkSecret(req, res)) return;
  const { speaker, text } = req.body;
  if (!speaker || !text) return res.status(400).json({ error: 'Missing fields' });
  await channel.send({
    type: 'broadcast',
    event: 'message',
    payload: { id: Date.now(), name: `🌐 ${speaker}`, avatarUrl: '', text, fromSL: true }
  });
  res.json({ ok: true });
});

app.post('/api/secondlife/outgoing', (req, res) => {
  if (!checkSecret(req, res)) return;
  const messages = [...outgoingQueue];
  outgoingQueue = [];
  res.json({ messages });
});

app.get('/api/twitch-status', async (req, res) => {
  try {
    const r = await fetch('https://www.twitch.tv/olyesti');
    const html = await r.text();
    const live = html.includes('"isLiveBroadcast"');
    res.json({ live });
  } catch(e) {
    res.json({ live: false });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Relay running on port ${PORT}`));

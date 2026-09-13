const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const app = express();
app.use(express.json());
const path = require('path');
app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const SECRET = 'OlyestiRelay!AmberSky49#';
const SUPABASE_URL = 'https://esaeyeqjbktkcdrydgmy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzYWV5ZXFqYmt0a2NkcnlkZ215Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNzIwMDgsImV4cCI6MjEwNDc0ODAwOH0.jq909W6aOx7lIO6m_4wxwUv3vJ2xxowLbay2SJ7O1_8';

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Rolling buffer of recent web messages for SL to pick up
let outgoingQueue = [];

// Subscribe to lounge-chat and buffer web messages for SL polling
const channel = db.channel('lounge-chat');
channel.on('broadcast', { event: 'message' }, ({ payload }) => {
  // Only relay messages that came from the web (not from SL itself)
  if (payload.fromSL) return;
  outgoingQueue.push({ speaker: payload.name, text: payload.text });
  if (outgoingQueue.length > 20) outgoingQueue.shift(); // keep last 20
}).subscribe();

function checkSecret(req, res) {
  if (req.headers['x-olyesti-secret'] !== SECRET) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

// SL → Web: receive SL chat and broadcast to Supabase lounge-chat
app.post('/api/secondlife/incoming', async (req, res) => {
  if (!checkSecret(req, res)) return;
  const { speaker, text } = req.body;
  if (!speaker || !text) return res.status(400).json({ error: 'Missing fields' });

  await channel.send({
    type: 'broadcast',
    event: 'message',
    payload: {
      id: Date.now(),
      name: `🌐 ${speaker}`,
      avatarUrl: '',
      text,
      fromSL: true
    }
  });

  res.json({ ok: true });
});

// Web → SL: return buffered web messages and clear the queue
app.post('/api/secondlife/outgoing', (req, res) => {
  if (!checkSecret(req, res)) return;
  const messages = [...outgoingQueue];
  outgoingQueue = []; // clear after delivering
  res.json({ messages });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Relay running on port ${PORT}`));

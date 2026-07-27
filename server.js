import crypto from 'node:crypto';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

const relaySecret = process.env.RELAY_SECRET;
if (!relaySecret) throw new Error('RELAY_SECRET must be set before starting the bridge.');

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: false } });
const recentMessages = [];
const messagesForSecondLife = [];

app.use(express.static('public'));
app.use('/api/secondlife', express.text({ type: 'application/json', limit: '8kb' }));

function relayIsAuthorized(req) {
  const supplied = req.get('X-olyesti-secret') || '';
  const a = Buffer.from(supplied);
  const b = Buffer.from(relaySecret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function parseJson(req, res) {
  try { return req.body ? JSON.parse(req.body) : {}; }
  catch { res.status(400).json({ error: 'Body must be valid JSON.' }); return null; }
}

function text(value, maximum) {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function publish(message) {
  recentMessages.push(message);
  if (recentMessages.length > 200) recentMessages.shift();
  io.emit('message', message);
}

// Called by the LSL object whenever it hears nearby public chat.
app.post('/api/secondlife/incoming', (req, res) => {
  if (!relayIsAuthorized(req)) return res.sendStatus(401);
  const body = parseJson(req, res);
  if (!body) return;
  const speaker = text(body.speaker, 64);
  const messageText = text(body.text, 500);
  const relay = text(body.relay, 64) || 'Olyesti';
  if (!speaker || !messageText) return res.status(422).json({ error: 'speaker and text are required.' });
  publish({ id: crypto.randomUUID(), source: 'secondlife', speaker, text: messageText, relay, at: Date.now() });
  res.json({ ok: true });
});

// Called by the LSL object every few seconds. The response is JSON that the script parses.
app.post('/api/secondlife/outgoing', (req, res) => {
  if (!relayIsAuthorized(req)) return res.sendStatus(401);
  const body = parseJson(req, res);
  if (!body) return;
  res.json({ messages: messagesForSecondLife.splice(0, 10) });
});

io.on('connection', socket => {
  socket.emit('history', recentMessages);
  socket.on('web-message', payload => {
    // Replace this display-name input with your Shopify customer authentication before public launch.
    const speaker = text(payload?.name, 32);
    const messageText = text(payload?.text, 300);
    if (!speaker || !messageText) return;
    const message = { id: crypto.randomUUID(), source: 'web', speaker, text: messageText, relay: 'Olyesti.com', at: Date.now() };
    messagesForSecondLife.push(message);
    publish(message);
  });
});

server.listen(process.env.PORT || 3000, () => console.log('Olyesti chat bridge is running.'));

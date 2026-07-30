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

// FIX: Track connected web users by socket ID
const connectedUsers = new Map(); // socketId → { name, gender, tint }

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

// Called by the LSL object every few seconds.
app.post('/api/secondlife/outgoing', (req, res) => {
  if (!relayIsAuthorized(req)) return res.sendStatus(401);
  const body = parseJson(req, res);
  if (!body) return;
  res.json({ messages: messagesForSecondLife.splice(0, 10) });
});

io.on('connection', socket => {
  // Send recent message history to the new connection
  socket.emit('history', recentMessages);

  // FIX: Send current online users to the newly connected client
  const currentUsers = Array.from(connectedUsers.values());
  if (currentUsers.length > 0) {
    socket.emit('presence-init', currentUsers);
  }

  socket.on('web-message', payload => {
    const speaker = text(payload?.name, 32);
    const messageText = text(payload?.text, 300);
    const gender = payload?.gender === 'female' ? 'female' : 'male';
    const tint = Number.isInteger(payload?.tint) ? payload.tint : 0;
    if (!speaker || !messageText) return;

    // FIX: Register user presence on first message if not already tracked
    if (!connectedUsers.has(socket.id)) {
      connectedUsers.set(socket.id, { name: speaker, gender, tint });
      // Broadcast this user's arrival to all OTHER clients
      socket.broadcast.emit('user-joined', { name: speaker, gender, tint });
    }

    const message = {
      id: crypto.randomUUID(),
      source: 'web',
      speaker,
      text: messageText,
      gender,
      tint,
      relay: 'Olyesti.com',
      at: Date.now()
    };
    messagesForSecondLife.push(message);
    publish(message);
  });

  // FIX: When a socket disconnects, remove them and notify all clients
  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      connectedUsers.delete(socket.id);
      // Tell all clients to remove this avatar
      io.emit('user-left', { name: user.name });
    }
  });
});

server.listen(process.env.PORT || 3000, () => console.log('Olyesti chat bridge is running.'));


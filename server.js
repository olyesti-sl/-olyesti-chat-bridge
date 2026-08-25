 const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static('public'));

const SECRET = 'OlyestiRelay!AmberSky49#';
const history = [];
const users = {};
const seats = {};
const outgoingQueue = [];

// ─── Second Life API endpoints ───────────────────────────────────────────────

// SL → Web: Second Life sends chat here
app.post('/api/secondlife/incoming', (req, res) => {
  if (req.headers['x-olyesti-secret'] !== SECRET)
    return res.status(403).json({ error: 'forbidden' });
  const { speaker, text } = req.body;
  if (!speaker || !text) return res.json({ ok: false });
  const msg = { source: 'secondlife', speaker, text };
  history.push(msg);
  if (history.length > 100) history.shift();
  io.emit('message', msg);
  res.json({ ok: true });
});

// Web → SL: Second Life polls for queued web messages
app.post('/api/secondlife/outgoing', (req, res) => {
  if (req.headers['x-olyesti-secret'] !== SECRET)
    return res.status(403).json({ error: 'forbidden' });
  res.json({ messages: outgoingQueue.splice(0, 10) });
});

// ─── Socket.io ───────────────────────────────────────────────────────────────

io.on('connection', socket => {
  console.log('connected:', socket.id);

  socket.emit('history', history.slice(-20));
  socket.emit('presence-init', Object.values(users));
  socket.emit('seats-init', seats);

  // User joins
  socket.on('user-join', data => {
    users[socket.id] = {
      name: data.name, avatar: data.avatar,
      gender: data.gender,
      x: data.x || 50, y: data.y || 82,
      seat: null
    };
    io.emit('user-joined', users[socket.id]);
  });

  // Position update
  socket.on('position', data => {
    if (!users[socket.id]) return;
    users[socket.id].x = data.x;
    users[socket.id].y = data.y;
    socket.broadcast.emit('user-moved', {
      name: users[socket.id].name,
      avatar: users[socket.id].avatar,
      gender: users[socket.id].gender,
      x: data.x, y: data.y
    });
  });

  // Sit down
  socket.on('sit', data => {
    if (!users[socket.id]) return;
    const { seatId, x, y } = data;
    if (users[socket.id].seat) {
      seats[users[socket.id].seat] = null;
    }
    seats[seatId] = users[socket.id].name;
    users[socket.id].seat = seatId;
    users[socket.id].x = x;
    users[socket.id].y = y;
    io.emit('user-sat', {
      name: users[socket.id].name,
      avatar: users[socket.id].avatar,
      gender: users[socket.id].gender,
      seatId, x, y
    });
    io.emit('seat-update', { seatId, occupant: users[socket.id].name });
  });

  // Stand up
  socket.on('stand', () => {
    if (!users[socket.id]) return;
    const seatId = users[socket.id].seat;
    if (seatId) {
      seats[seatId] = null;
      users[socket.id].seat = null;
      io.emit('user-stood', { name: users[socket.id].name });
      io.emit('seat-update', { seatId, occupant: null });
    }
  });

  // Web chat message → broadcast + queue for SL
  socket.on('web-message', data => {
    const msg = {
      source: 'web',
      speaker: data.name,
      text: data.text,
      avatar: data.avatar,
      gender: data.gender,
      x: users[socket.id]?.x || 50,
      y: users[socket.id]?.y || 82
    };
    history.push(msg);
    if (history.length > 100) history.shift();
    io.emit('message', msg);
    // Queue for SL pickup
    outgoingQueue.push({ speaker: data.name, text: data.text });
    if (outgoingQueue.length > 50) outgoingQueue.shift();
  });

  // Second Life relay (legacy socket path)
  socket.on('sl-message', data => {
    const msg = { source: 'secondlife', speaker: data.speaker, text: data.text };
    history.push(msg);
    if (history.length > 100) history.shift();
    io.emit('message', msg);
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (users[socket.id]) {
      const seatId = users[socket.id].seat;
      if (seatId) {
        seats[seatId] = null;
        io.emit('seat-update', { seatId, occupant: null });
      }
      io.emit('user-left', { name: users[socket.id].name });
      delete users[socket.id];
    }
    console.log('disconnected:', socket.id);
  });
});

// ─── Start server ─────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Olyesti chat running on port ${PORT}`));

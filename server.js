const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const history = [];
const users = {};   // socket.id → { name, avatar, gender, x, y, seat }
const seats = {};   // seatId → name of occupant (or null)

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
    // Free previous seat
    if (users[socket.id].seat) {
      seats[users[socket.id].seat] = null;
    }
    // Occupy new seat
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

  // Chat message
  socket.on('web-message', data => {
    const msg = {
      source: 'web', speaker: data.name, text: data.text,
      avatar: data.avatar, gender: data.gender,
      x: users[socket.id]?.x || 50,
      y: users[socket.id]?.y || 82
    };
    history.push(msg);
    if (history.length > 100) history.shift();
    io.emit('message', msg);
  });

  // Second Life relay
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Olyesti chat running on port ${PORT}`));

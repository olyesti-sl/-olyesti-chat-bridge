const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const history = [];
const users = {};

io.on('connection', socket => {
  console.log('connected:', socket.id);

  socket.emit('history', history.slice(-20));
  socket.emit('presence-init', Object.values(users));

  socket.on('user-join', data => {
    users[socket.id] = {
      name: data.name,
      avatar: data.avatar,
      gender: data.gender,
      x: data.x || 50,
      y: data.y || 80
    };
    io.emit('user-joined', users[socket.id]);
  });

  socket.on('position', data => {
    if (users[socket.id]) {
      users[socket.id].x = data.x;
      users[socket.id].y = data.y;
      socket.broadcast.emit('user-moved', {
        name: users[socket.id].name,
        avatar: users[socket.id].avatar,
        gender: users[socket.id].gender,
        x: data.x,
        y: data.y
      });
    }
  });

  socket.on('web-message', data => {
    const msg = {
      source: 'web',
      speaker: data.name,
      text: data.text,
      avatar: data.avatar,
      gender: data.gender,
      x: users[socket.id]?.x || 50,
      y: users[socket.id]?.y || 80
    };
    history.push(msg);
    if (history.length > 100) history.shift();
    io.emit('message', msg);
  });

  socket.on('sl-message', data => {
    const msg = { source: 'secondlife', speaker: data.speaker, text: data.text };
    history.push(msg);
    if (history.length > 100) history.shift();
    io.emit('message', msg);
  });

  socket.on('disconnect', () => {
    if (users[socket.id]) {
      io.emit('user-left', { name: users[socket.id].name });
      delete users[socket.id];
    }
    console.log('disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Olyesti chat running on port ${PORT}`));

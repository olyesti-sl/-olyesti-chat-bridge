const socket = io();
const box = document.querySelector('#messages');
const nameInput = document.querySelector('#name');
const textInput = document.querySelector('#text');
function show(message) {
  const line = document.createElement('p');
  const time = new Date(message.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  line.textContent = `[${time}] ${message.speaker}: ${message.text}`;
  box.append(line); box.scrollTop = box.scrollHeight;
}
socket.on('history', messages => messages.forEach(show));
socket.on('message', show);
document.querySelector('#chat').addEventListener('submit', event => {
  event.preventDefault();
  socket.emit('web-message', { name: nameInput.value, text: textInput.value });
  textInput.value = ''; textInput.focus();
});

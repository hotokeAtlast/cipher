// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors()); // Allow standard HTTP requests

const server = http.createServer(app);

// Initialize Socket.io with strictly controlled CORS
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Only allow our React app to connect
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log(`[+] User connected: ${socket.id}`);

  // When a user joins, put them in the general channel
  socket.on('join_room', (roomId) => {
    // Leave all previous rooms (except their socket ID room)
    const currentRooms = Array.from(socket.rooms);
    currentRooms.forEach(room => {
      if(room !== socket.id){
        socket.leave(room);
        console.log(`[-] User left room ${room}`);
      }
    });

    // join the new room
    socket.join(roomId);
    console.log(`[+] User joined room ${roomId}`);
  });

  // Listen for chat messages
  socket.on('send_message', (data) => {
    console.log(`[${data.room}] ${data.user.name}: ${data.text}`);
    
    io.to(data.room).emit('receive_message', data);
  });

  socket.on('disconnect', () => {
    console.log(`[-] User disconnected: ${socket.id}`);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Cipher API is running on http://localhost:${PORT}`);
});
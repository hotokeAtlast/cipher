// client/src/socket.js
import { io } from 'socket.io-client';

// Connect to our Node backend
export const socket = io('http://localhost:3000');
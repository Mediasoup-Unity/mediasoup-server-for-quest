import { io } from 'socket.io-client';

const protocol = "https";
const backendPort = 5173;
const backendHost = window.location.hostname;
const backendUrl = `${protocol}://${backendHost}:${backendPort}/mediasoup`;
console.log("backendHost", backendUrl);

export const socket = io(backendUrl, {
  autoConnect: true,
  reconnection: true,
  secure: true,
  rejectUnauthorized: false,
});

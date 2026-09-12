import { io } from "socket.io-client";
import { API_URL } from "./api";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? API_URL.replace(/\/api\/v1\/?$/, "");

export const attemptSocket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
  transports: ["websocket", "polling"]
});

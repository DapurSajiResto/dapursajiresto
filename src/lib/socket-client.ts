// Socket.IO client hook untuk frontend React
// Connect ke Socket.IO server (NEXT_PUBLIC_SOCKET_URL atau same-origin /api/socketio)
// Graceful degradation: jika socket server tidak ada, hook tetap jalan (no real-time) tanpa bikin lag

"use client";

import { useEffect, useState, useRef } from "react";
import { io as ioClient, Socket } from "socket.io-client";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "";

export function useSocket(tenantId: string | null | undefined) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!tenantId) return;

    const socket = ioClient(SOCKET_URL, {
      path: "/api/socketio",
      auth: { tenantId },
      transports: ["websocket"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 3, // cuma retry 3x, lalu stop (sebelumnya 10)
      reconnectionDelay: 2000, // delay 2s antar retry (sebelumnya 1s)
    });

    socketRef.current = socket;

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));
    socket.on("connect_error", () => {
      setIsConnected(false);
      // Stop retry setelah error — jangan bikin browser sibuk
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [tenantId]);

  return {
    socket: socketRef.current,
    isConnected,
  };
}

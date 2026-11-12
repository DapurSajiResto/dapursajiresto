// Socket.IO server - real-time sync antar device per tenant
//
// Catatan implementasi:
// - Next.js (Vercel) tidak ideal untuk Socket.IO persistent connection.
// - Untuk production: jalankan server Socket.IO terpisah di Railway/Fly.io/VPS,
//   set SOCKET_SERVER_URL di env, frontend connect ke sana.
// - Untuk development: bisa jalan di Next.js custom server.
//
// Setup production recommended:
//   1. Deploy server Socket.IO terpisah (file: server/socket-server.js)
//   2. Frontend connect via NEXT_PUBLIC_SOCKET_URL

import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";

let io: SocketIOServer | null = null;

export function initSocketIO(server: HTTPServer): SocketIOServer {
  if (io) return io;

  io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/api/socketio",
  });

  // Middleware: validasi tenant dari handshake
  io.use((socket, next) => {
    const tenantId = socket.handshake.auth.tenantId as string | undefined;
    if (!tenantId) {
      return next(new Error("Unauthorized: tenantId required"));
    }
    // Simpan tenantId di socket data untuk dipakai saat join room
    socket.data.tenantId = tenantId;
    next();
  });

  io.on("connection", (socket) => {
    const tenantId = socket.data.tenantId as string;
    // Join room per-tenant: hanya device resto yang sama yang sinkron
    socket.join(`tenant:${tenantId}`);

    // console.log(`[Socket.IO] Client connected, tenant: ${tenantId}, id: ${socket.id}`);

    socket.on("disconnect", () => {
      // console.log(`[Socket.IO] Disconnected: ${socket.id}`);
    });
  });

  return io;
}

/**
 * Emit event ke semua client dalam satu tenant.
 * Dipanggil dari API route setelah DB mutation.
 */
export function emitToTenant(
  ioInstance: SocketIOServer | null,
  tenantId: string,
  event: string,
  payload: unknown
) {
  if (!ioInstance) return;
  ioInstance.to(`tenant:${tenantId}`).emit(event, payload);
}

// Singleton getter (dipakai di route handlers)
export function getIO(): SocketIOServer | null {
  return io;
}

// Event names - shared konstan agar frontend & backend sinkron
export const SOCKET_EVENTS = {
  ORDER_NEW: "order:new",
  ORDER_STATUS_UPDATE: "order:status_update",
  ORDER_PAID: "order:paid",
  MENU_UPDATED: "menu:updated",
} as const;

export type SocketEventName =
  (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

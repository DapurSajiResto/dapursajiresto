// Socket.IO server standalone (untuk production)
//
// Next.js (Vercel serverless) tidak ideal untuk Socket.IO persistent connection.
// Jalankan file ini terpisah di Railway/Fly.io/VPS:
//
//   node server/socket-server.js  (atau pakai tsx)
//
// Set env:
//   SOCKET_PORT=3001
//   NEXTAUTH_URL=https://namadomain.com  (untuk CORS)
//
// Frontend akan connect ke server ini via NEXT_PUBLIC_SOCKET_URL

import { createServer } from "http";
import { Server } from "socket.io";

const PORT = Number(process.env.SOCKET_PORT || 3001);
const ALLOWED_ORIGIN = process.env.NEXTAUTH_URL || "*";

const httpServer = createServer((req, res) => {
  // Health check endpoint
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "socket-io", uptime: process.uptime() }));
    return;
  }
  res.writeHead(404);
  res.end("Not Found");
});

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGIN === "*" ? "*" : [ALLOWED_ORIGIN],
    methods: ["GET", "POST"],
  },
  path: "/api/socketio",
});

// Middleware: validasi tenantId dari handshake
io.use((socket, next) => {
  const tenantId = socket.handshake.auth.tenantId;
  if (!tenantId || typeof tenantId !== "string") {
    return next(new Error("Unauthorized: tenantId required"));
  }
  socket.data.tenantId = tenantId;
  next();
});

io.on("connection", (socket) => {
  const tenantId = socket.data.tenantId;
  socket.join(`tenant:${tenantId}`);
  console.log(`[Socket.IO] Connected tenant=${tenantId} id=${socket.id}`);

  socket.on("disconnect", (reason) => {
    console.log(`[Socket.IO] Disconnected id=${socket.id} reason=${reason}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[Socket.IO] Server running on port ${PORT}`);
  console.log(`[Socket.IO] CORS allowed: ${ALLOWED_ORIGIN}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[Socket.IO] SIGTERM received, shutting down...");
  io.close(() => {
    httpServer.close(() => {
      process.exit(0);
    });
  });
});

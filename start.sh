#!/bin/sh
# Start script untuk DapurSajiResto
# 1. Run Prisma migrations
# 2. Start Next.js app
# 3. Start Socket.IO server (in background)

set -e

echo "[START] Running database migrations..."
npx prisma migrate deploy 2>/dev/null || npx prisma db push 2>/dev/null || echo "[START] Migration skipped (will retry)"

echo "[START] Starting Next.js application..."
# Start Next.js in background
node server/socket-server.js &
SOCKET_PID=$!
echo "[START] Socket.IO server started (PID: $SOCKET_PID)"

# Start Next.js in foreground
exec npm start

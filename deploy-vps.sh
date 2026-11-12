#!/bin/bash
# ============================================================
# Deploy Script untuk DapurSajiResto VPS
# Jalankan di VPS setelah SSH login
# ============================================================

set -e

echo "=========================================="
echo "  DapurSajiResto - VPS Deploy Script"
echo "=========================================="

# 1. Install Docker
if ! command -v docker &> /dev/null; then
    echo "[1/6] Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "Docker installed."
else
    echo "[1/6] Docker already installed."
fi

# 2. Install Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "[2/6] Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo "Docker Compose installed."
else
    echo "[2/6] Docker Compose already installed."
fi

# 3. Clone repo
APP_DIR="/opt/dapursaji"
if [ ! -d "$APP_DIR" ]; then
    echo "[3/6] Cloning repository..."
    mkdir -p /opt
    git clone https://github.com/DapurSajiResto/dapursajiresto.git "$APP_DIR"
else
    echo "[3/6] Repository exists, pulling latest..."
    cd "$APP_DIR"
    git pull origin main || true
fi

cd "$APP_DIR"

# 4. Setup environment file
if [ ! -f ".env.production" ]; then
    echo "[4/6] Creating .env.production from template..."
    cp .env.example .env.production
    echo "IMPORTANT: Edit /opt/dapursaji/.env.production with your real values!"
    echo "Then re-run this script."
    exit 1
else
    echo "[4/6] .env.production exists."
fi

# 5. Build and start containers
echo "[5/6] Building and starting containers..."
docker-compose down 2>/dev/null || true
docker-compose build --no-cache
docker-compose up -d

# 6. Wait and check
echo "[6/6] Waiting for containers to start..."
sleep 10

if docker-compose ps | grep -q "Up"; then
    echo ""
    echo "=========================================="
    echo "  DEPLOY SUCCESS!"
    echo "=========================================="
    echo ""
    echo "  App URL:     http://$(hostname -I | awk '{print $1}'):3000"
    echo "  Socket URL:  http://$(hostname -I | awk '{print $1}'):3001"
    echo ""
    echo "  Next steps:"
    echo "  1. Point your domain A record to: $(hostname -I | awk '{print $1}')"
    echo "  2. Edit Caddyfile with your domain"
    echo "  3. Run: docker-compose restart caddy"
    echo ""
else
    echo "ERROR: Containers failed to start. Check logs:"
    docker-compose logs --tail=50
    exit 1
fi

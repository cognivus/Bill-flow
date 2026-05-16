#!/bin/bash
# ================================================
# BillFlow Quick Start Script
# Run: bash setup.sh
# ================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}"
echo "  ____  _ _ _ _____ _               "
echo " |  _ \(_) | |  ___| | _____      __"
echo " | |_) | | | | |_  | |/ _ \ \ /\ / /"
echo " |  _ <| | | |  _| | | (_) \ V  V / "
echo " |_| \_\_|_|_|_|   |_|\___/ \_/\_/  "
echo -e "${NC}"
echo -e "${GREEN}BillFlow SaaS Billing Platform — Setup${NC}"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found. Install from https://docker.com${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker found${NC}"

# Check .env
if [ ! -f "./backend/.env" ]; then
    echo -e "${YELLOW}⚠  backend/.env not found — copying from example${NC}"
    cp ./backend/.env.example ./backend/.env
    echo -e "${RED}⚠  IMPORTANT: Edit backend/.env with your Supabase credentials before continuing!${NC}"
    echo "   Open backend/.env and set:"
    echo "   - DATABASE_URL"
    echo "   - SUPABASE_URL"
    echo "   - SUPABASE_ANON_KEY"
    echo "   - SUPABASE_SERVICE_ROLE_KEY"
    echo ""
    read -p "Press Enter after editing .env to continue..."
fi
echo -e "${GREEN}✓ .env configured${NC}"

echo ""
echo -e "${BLUE}Step 1: Running database schema on Supabase...${NC}"
echo "   → Go to https://supabase.com/dashboard"
echo "   → Open your project → SQL Editor"
echo "   → Run: docs/schema.sql"
echo "   → (Optional) Run: docs/seed.sql for demo data"
echo ""
read -p "Press Enter after running the SQL schema..."

echo ""
echo -e "${BLUE}Step 2: Building and starting Docker containers...${NC}"
docker compose up --build -d

echo ""
echo -e "${BLUE}Step 3: Waiting for backend to be healthy...${NC}"
sleep 5

MAX_WAIT=60
COUNT=0
until curl -sf http://localhost:8000/api/health > /dev/null 2>&1; do
    COUNT=$((COUNT + 2))
    if [ $COUNT -ge $MAX_WAIT ]; then
        echo -e "${RED}❌ Backend health check timed out. Check logs: docker compose logs backend${NC}"
        exit 1
    fi
    echo "   Waiting... ($COUNT/${MAX_WAIT}s)"
    sleep 2
done

echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ BillFlow is running!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
echo -e "  Frontend:  ${BLUE}http://localhost:3000${NC}"
echo -e "  API Docs:  ${BLUE}http://localhost:8000/api/docs${NC}"
echo -e "  Health:    ${BLUE}http://localhost:8000/api/health${NC}"
echo ""
echo -e "  ${YELLOW}Admin:${NC}  admin@billflow.io / (your password)"
echo -e "  ${YELLOW}Demo:${NC}   demo@billflow.io  / Demo@1234 (if seeded)"
echo ""
echo -e "${BLUE}Commands:${NC}"
echo "  View logs:   docker compose logs -f"
echo "  Stop:        docker compose down"
echo "  Restart:     docker compose restart"
echo ""

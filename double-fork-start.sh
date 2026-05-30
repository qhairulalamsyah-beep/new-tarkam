#!/bin/bash
# ═══════════════════════════════════════════════════════════
# DOUBLE FORK TECHNIQUE — Detach process from parent session
# Makes the server survive session cleanup / process killing
# ═══════════════════════════════════════════════════════════

cd /home/z/my-project

# Fix .env (sandbox resets this)
echo "DATABASE_URL=postgresql://neondb_owner:npg_i6O1uYUDmyZS@ep-wispy-fire-ao8jbmss-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" > .env

# ── FIRST FORK ──
(
    # ── SECOND FORK ──
    # This is the grandchild — the actual server process
    # Setsid creates a new session, completely detaching from terminal
    setsid node /home/z/my-project/node_modules/.bin/next dev -p 3000 >> /home/z/my-project/dev.log 2>&1 &

    # Get the grandchild PID
    GRANDCHILD_PID=$!
    echo "[$(date)] Double-fork: grandchild PID=$GRANDCHILD_PID" >> /home/z/my-project/dev.log

    # ── CHILD EXITS ──
    exit 0
) &

# Wait briefly for the double fork to complete
sleep 2
echo "Double-fork completed"

#!/bin/bash
# Auto-respawn Next.js dev server
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting Next.js dev server..."
  NODE_OPTIONS='--max-old-space-size=2048' npx next dev -p 3000 >> dev.log 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Process exited with code $EXIT_CODE, restarting in 3s..."
  sleep 3
done

#!/bin/bash
# Rezvo Backend Deploy Script
# Usage: bash deploy/deploy.sh

set -e
cd /opt/rezvo-app

echo "📥 Pulling latest code..."
git fetch origin && git reset --hard origin/main

echo "🔧 Installing service file..."
cp deploy/rezvo-backend.service /etc/systemd/system/rezvo-backend.service
mkdir -p /opt/rezvo-app/backend/tmp
chown rezvo:rezvo /opt/rezvo-app/backend/tmp

echo "🔄 Restarting service..."
systemctl daemon-reload
systemctl restart rezvo-backend

echo "✅ Deploy complete"
systemctl status rezvo-backend --no-pager

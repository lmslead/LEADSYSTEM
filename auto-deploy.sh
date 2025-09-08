#!/bin/bash

# LEADSYSTEM Auto-Deploy Script
# Use this script for future updates

set -e

echo "🔄 Starting auto-deployment for LEADSYSTEM..."

# Change to project directory
cd /var/www/leadsystem/LEADSYSTEM

# Create backup
echo "💾 Creating backup..."
sudo cp -r /var/www/leadsystem/LEADSYSTEM /var/www/leadsystem/backup-$(date +%Y%m%d-%H%M%S) 2>/dev/null || echo "Backup creation failed, continuing..."

# Pull latest changes
echo "📥 Pulling latest changes from GitHub..."
git fetch origin
git reset --hard origin/main

# Install/update server dependencies
echo "📦 Updating server dependencies..."
cd server
npm install --production

# Build client with latest changes
echo "🏗️ Building client application..."
cd ../client
npm install
npm run build

# Update environment files
echo "⚙️ Updating environment configuration..."
cp .env.production .env
cd ../server
cp .env.production .env

# Restart application
echo "🔄 Restarting application..."
cd /var/www/leadsystem/LEADSYSTEM
pm2 restart ecosystem.config.js
pm2 save

# Clear old logs
echo "🗑️ Cleaning old logs..."
pm2 flush

echo "✅ Auto-deployment completed successfully!"
echo "🌐 Application is now updated and running"
echo "📊 Check status: pm2 status"
echo "📝 Check logs: pm2 logs"

# Test the deployment
echo "🧪 Testing deployment..."
sleep 5
if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    echo "✅ Backend health check passed"
else
    echo "❌ Backend health check failed"
fi

if [ -f "/var/www/leadsystem/LEADSYSTEM/client/build/index.html" ]; then
    echo "✅ Frontend build verified"
else
    echo "❌ Frontend build verification failed"
fi

echo "🎉 Deployment process completed!"

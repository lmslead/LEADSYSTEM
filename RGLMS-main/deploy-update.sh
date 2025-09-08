#!/bin/bash

# LMS Auto-Update Deployment Script
# Run this script for future updates

echo "🔄 Starting LMS Auto-Update Process..."

cd /var/www/lms/LEADSYSTEM

# Stop PM2 processes
echo "⏹️ Stopping services..."
pm2 stop all

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Update server dependencies if package.json changed
echo "📦 Updating dependencies..."
cd server
npm install --production

# Build and deploy client
echo "🏗️ Building client..."
cd ../client
npm install
npm run build

# Update static files
echo "🔧 Updating static files..."
sudo rm -rf /var/www/html/*
sudo cp -r build/* /var/www/html/

# Restart services
echo "🚀 Restarting services..."
cd ../
pm2 restart all

# Show status
echo "✅ Auto-update completed!"
echo "📊 Current Status:"
pm2 status

#!/bin/bash

# LMS Manual Deployment Script for AWS EC2 (100.24.13.0)
# Run this script as ubuntu user

echo "🚀 Starting LMS Deployment Process..."

# Create application directory
sudo mkdir -p /var/www/lms
sudo chown ubuntu:ubuntu /var/www/lms
cd /var/www/lms

# Clone the repository
echo "📥 Cloning repository..."
git clone https://github.com/lmslead/LEADSYSTEM.git
cd LEADSYSTEM

# Install server dependencies
echo "📦 Installing server dependencies..."
cd server
npm install --production

# Install client dependencies and build
echo "📦 Installing client dependencies and building..."
cd ../client
npm install
npm run build

# Copy production build to nginx directory
echo "🔧 Setting up static files..."
sudo rm -rf /var/www/html/*
sudo cp -r build/* /var/www/html/

# Setup PM2 for backend
echo "🔄 Setting up PM2 for backend..."
cd ../
sudo chown -R ubuntu:ubuntu /var/www/lms
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save
pm2 startup

echo "✅ Manual deployment completed!"
echo "🌐 Frontend: http://100.24.13.0"
echo "🔗 Backend API: http://100.24.13.0:5000"
echo "📊 PM2 Status: pm2 status"

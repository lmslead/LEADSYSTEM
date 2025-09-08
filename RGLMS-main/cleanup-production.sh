#!/bin/bash

# Production Cleanup Script - Remove unnecessary files
echo "🧹 Cleaning up unnecessary files for production..."

# Remove development dependencies from node_modules (if they exist)
echo "📦 Cleaning development dependencies..."
cd /var/www/lms/LEADSYSTEM/server
npm prune --production

# Remove unnecessary files and folders
echo "🗑️ Removing unnecessary files..."
cd /var/www/lms/LEADSYSTEM

# Remove client source files after build (keep only build folder)
rm -rf client/src/
rm -rf client/public/
rm -f client/package-lock.json
rm -f client/postcss.config.js
rm -f client/tailwind.config.js

# Remove development files
rm -rf .git/
rm -f .gitignore
rm -f *.test.js
rm -rf test/
rm -rf tests/
rm -rf coverage/

# Remove IDE files
rm -rf .vscode/
rm -rf .idea/
rm -f *.swp
rm -f *.swo

# Remove OS files
find . -name ".DS_Store" -delete
find . -name "Thumbs.db" -delete

# Remove log files
find . -name "*.log" -delete

# Remove backup files
find . -name "*.backup" -delete
find . -name "*.bak" -delete

# Set proper permissions
sudo chown -R ubuntu:ubuntu /var/www/lms
chmod -R 755 /var/www/lms

echo "✅ Cleanup completed!"
echo "📊 Current directory size:"
du -sh /var/www/lms/LEADSYSTEM
